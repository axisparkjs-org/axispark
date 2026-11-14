import { Processable } from '@axisparkjs/common';
import { ExecutionContext } from '../execution';
import { PipeDefinition } from './pipe-definition';
import { PipeStepSkip } from './pipe-step';
import { Injectable, Injector } from '@axisparkjs/di';

/**
 * A processor for executing pipe definitions.
 */
@Injectable()
export class PipeProcessor implements Processable {
    constructor(private readonly injector: Injector) {}

    /**
     * Processes an array of pipe definitions using the provided execution context. When a step returns `PipeStepSkip`, the rest of the steps of its parameter are skipped and the parameter is `undefined`.
     * @param pipes An array of `PipeDefinition` instances to process.
     * @param context The execution context containing relevant information for processing.
     * @returns A promise resolving to an array of the processed results.
     */
    async process(pipes: PipeDefinition[], context: ExecutionContext): Promise<any[]> {
        const results: any[] = [];

        for (const pipe of pipes) {
            const parameter = pipe.parameter;
            for (const step of pipe.steps) {
                const pipeStep = await this.injector.get(step.pipeStep, context.scopedContainer);
                const value = await pipeStep.execute(parameter, step.pipeStepConfig, context);
                if (value === PipeStepSkip) {
                    parameter.setValue(undefined);
                    break;
                }
                parameter.setValue(value);
            }
            results.push(parameter.value);
        }
        return results;
    }
}
