import { Generator, Metadata, MetadataKeys } from '@axisparkjs/common';
import { PipeMetadata } from '../metadata';
import { ExecutionHandler } from '../execution';
import { PipeScope } from './pipe-scope';
import { PipeDefinition } from './pipe-definition';
import { ParameterDefinition } from '../parameter';
import { Injectable } from '@axisparkjs/di';

/**
 * A generator for creating pipe definitions based on metadata.
 */
@Injectable()
export class PipeGenerator implements Generator<PipeDefinition[]> {
    /**
     * Generates an array of `PipeDefinition` instances based on the provided parameters and execution handler.
     * @param parameters An array of `ParameterDefinition` instances representing the parameters to be processed.
     * @param handler The execution handler that provides metadata for the pipes.
     * @returns An array of `PipeDefinition` instances representing the generated pipes.
     */
    async generate(parameters: ParameterDefinition[], handler: ExecutionHandler): Promise<PipeDefinition[]> {
        const classPipes = Metadata.get<PipeMetadata[]>(MetadataKeys.PIPE, handler.target) ?? [];
        const methodPipes = (Metadata.get<PipeMetadata[]>(MetadataKeys.PIPE, handler.target, handler.propertyKey) ?? []).filter(
            (x) => x.pipeScope === PipeScope.Method
        );
        const parameterPipes = (Metadata.get<PipeMetadata[]>(MetadataKeys.PIPE, handler.target, handler.propertyKey) ?? []).filter(
            (x) => x.pipeScope === PipeScope.Parameter
        );

        const pipes: PipeDefinition[] = [];
        for (const parameter of parameters) {
            const finalPipes = [...classPipes, ...methodPipes, ...parameterPipes.filter((x) => x.parameterIndex === parameter.parameterIndex)];
            const pipeSteps = [];
            for (const pipe of finalPipes) {
                for (const step of pipe.steps) {
                    const config = {
                        pipeStep: 'pipeStep' in step ? step.pipeStep : step,
                        pipeStepConfig: 'PipeStepConfig' in step ? step.PipeStepConfig : undefined
                    };
                    pipeSteps.push(config);
                }
            }
            pipes.push(new PipeDefinition(parameter, pipeSteps));
        }
        return pipes;
    }
}
