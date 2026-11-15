import { Metadata, MetadataKeys, Generator } from '@axisparkjs/common';
import { ParameterMetadata } from '../metadata/parameter-metadata';
import { ExecutionContext, ExecutionHandler } from '../execution';
import { ParameterResolver } from './parameter-resolver';
import { ParameterDefinition } from './parameter-definition';
import { Injectable } from '@axisparkjs/di';

/**
 * A generator for creating parameter definitions based on metadata.
 */
@Injectable()
export class ParameterGenerator implements Generator<ParameterDefinition[]> {
    private static readonly resolvers = new Map<string, ParameterResolver<any>>();

    /**
     * Registers a parameter resolver for a specific parameter type.
     * @param parameter The parameter type for which to register a resolver.
     * @param resolver The resolver to register.
     */
    static registerParameter(parameter: string, resolver: ParameterResolver<any>): void {
        this.resolvers.set(parameter, resolver);
    }

    /**
     * Generates an array of `ParameterDefinition` instances based on the provided execution context and handler.
     * It retrieves parameter metadata, resolves their values using registered resolvers, and constructs the corresponding parameter definitions.
     * @param executionContext The execution context containing relevant information for parameter resolution.
     * @param executionHandler The execution handler that provides metadata for the parameters.
     * @param resolving A boolean indicating whether to resolve the parameter values or just generate their definitions. Default is `true`.
     * @returns An array of `ParameterDefinition` instances representing the resolved parameters.
     */
    generate(executionContext: ExecutionContext | undefined, executionHandler: ExecutionHandler, resolving = true): ParameterDefinition[] {
        const parametersMetadata = Metadata.get<ParameterMetadata[]>(MetadataKeys.PARAMETER, executionHandler.target, executionHandler.propertyKey) ?? [];
        const args: ParameterDefinition[] = [];
        for (const parameterMetadata of parametersMetadata) {
            if (!ParameterGenerator.resolvers.has(parameterMetadata.parameter)) continue;

            const resolver = ParameterGenerator.resolvers.get(parameterMetadata.parameter) as ParameterResolver<any>;
            const parameter = ParameterDefinition.fromMetadata(parameterMetadata);
            if (resolving && executionContext) {
                const resolvedValue = resolver.resolve(executionContext, parameter);
                parameter.setValue(resolvedValue);
            }
            args[parameterMetadata.parameterIndex] = parameter;
        }

        return args;
    }

    /**
     * Resolves the value of a parameter generated without values (`resolving` set to `false`) for one execution. The definition is copied,
     * so the definitions generated once per handler can be reused by every execution.
     * @param executionContext The execution context of the invocation.
     * @param definition The definition of the parameter, without value.
     * @returns A copy of the definition with the resolved value.
     */
    resolve(executionContext: ExecutionContext, definition: ParameterDefinition): ParameterDefinition {
        const parameter = definition.clone();
        const resolver = ParameterGenerator.resolvers.get(parameter.parameter);
        if (resolver) parameter.setValue(resolver.resolve(executionContext, parameter));
        return parameter;
    }
}
