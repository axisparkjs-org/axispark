import { ClassType } from '@axisparkjs/common';
import { Injectable, Injector } from '@axisparkjs/di';
import { ExecutionContext } from './execution-context';
import { ExecutionHandler } from './execution-handler';
import { ParameterGenerator } from '../parameter';
import { PipeDefinition, PipeGenerator, PipeProcessor } from '../pipe';

/**
 * A class responsible for invoking execution handlers within a given execution context. It utilizes the `ParameterGenerator` to generate parameters for the handler, the `PipeGenerator` to generate pipes for processing the parameters, and the `PipeProcessor` to process the generated pipes. The class also uses an `Injector` to retrieve instances of the target classes associated with the execution handlers. The `invoke` method orchestrates the entire process of generating parameters, processing them through pipes, and invoking the handler method with the processed arguments.
 *
 * The parameters and the pipes of a handler are read from the metadata once, the first time the handler is invoked, and kept by the identity
 * of the class and the property key. Each invocation only resolves the values of the parameters and runs the pipes, so the request hot path
 * does not read metadata.
 *
 * The instances of the singleton targets (middlewares, guards, interceptors, filters and handlers) are kept after their first resolution, so
 * each execution only resolves the scoped and transient targets with the injector.
 */
@Injectable()
export class HandlerInvoker {
    private readonly singletons = new Map<ClassType, any>();
    private readonly prepared = new Map<ClassType, Map<PropertyKey, Promise<PipeDefinition[]>>>();

    constructor(
        private readonly parameterGenerator: ParameterGenerator,
        private readonly pipeGenerator: PipeGenerator,
        private readonly pipeProcessor: PipeProcessor,
        private readonly injector: Injector
    ) {}

    /**
     * Invokes the specified execution handler within the provided execution context. It resolves the parameters of the handler, processes them through pipes, and invokes the handler method with the processed arguments.
     * @param handler The execution handler to be invoked.
     * @param context The execution context in which the handler is invoked.
     * @returns A promise resolving to the result of the handler invocation.
     */
    public async invoke(handler: ExecutionHandler, context: ExecutionContext): Promise<unknown> {
        const prepared = await this.prepare(handler);
        const pipes = prepared.map((pipe) => new PipeDefinition(this.parameterGenerator.resolve(context, pipe.parameter), pipe.steps));
        const args = await this.pipeProcessor.process(pipes, context);

        const instance = this.singletons.get(handler.target) ?? (await this.resolve(handler.target, context));
        return instance[handler.propertyKey](...args);
    }

    private async resolve(target: ClassType, context: ExecutionContext): Promise<any> {
        const instance = await this.injector.get<any>(target, context.scopedContainer);
        if (this.injector.isSingleton(target)) this.singletons.set(target, instance);
        return instance;
    }

    /* The pipes of the handler with the parameter definitions without values, generated once per handler. */
    private prepare(handler: ExecutionHandler): Promise<PipeDefinition[]> {
        let ofTarget = this.prepared.get(handler.target);
        if (!ofTarget) {
            ofTarget = new Map();
            this.prepared.set(handler.target, ofTarget);
        }

        let prepared = ofTarget.get(handler.propertyKey);
        if (!prepared) {
            const parameters = this.parameterGenerator.generate(undefined, handler, false);
            prepared = this.pipeGenerator.generate(parameters, handler);
            const cache = ofTarget;
            prepared.catch(() => cache.delete(handler.propertyKey));
            ofTarget.set(handler.propertyKey, prepared);
        }
        return prepared;
    }
}
