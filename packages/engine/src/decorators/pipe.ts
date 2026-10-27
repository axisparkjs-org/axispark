import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { PipeMetadata } from '../metadata/pipe-metadata';
import { PipeStepConfig, PipeScope, PipeStep } from '../pipe';
import { ClassType } from '@axisparkjs/common';

/**
 * A decorator for defining pipes in the dependency injection system.
 * @param steps The steps to include in the pipe.
 * @returns A pipe decorator.
 */
export function Pipe(
    ...steps: (ClassType<PipeStep> | { pipeStep: ClassType<PipeStep>; PipeStepConfig: PipeStepConfig })[]
): ClassDecorator & MethodDecorator & ParameterDecorator {
    return (...args: any[]) => {
        // Class
        if (args.length === 1) {
            const [target] = args;

            const pipes = Metadata.get<PipeMetadata[]>(MetadataKeys.PIPE, target) ?? [];

            pipes.push({
                target: Metadata.normalizeTarget(target),
                pipeScope: PipeScope.Class,
                steps
            });

            Metadata.define(MetadataKeys.PIPE, pipes, target);
            return;
        }

        const [target, propertyKey, third] = args;
        const pipes = Metadata.get<PipeMetadata[]>(MetadataKeys.PIPE, target, propertyKey) ?? [];

        // Parameter
        if (typeof third === 'number') {
            pipes.push({
                target: Metadata.normalizeTarget(target),
                propertyKey,
                parameterIndex: third,
                pipeScope: PipeScope.Parameter,
                steps
            });

            Metadata.define(MetadataKeys.PIPE, pipes, target, propertyKey);

            return;
        }

        // Method
        pipes.push({
            target: Metadata.normalizeTarget(target),
            propertyKey,
            pipeScope: PipeScope.Method,
            steps
        });

        Metadata.define(MetadataKeys.PIPE, pipes, target, propertyKey);
    };
}
