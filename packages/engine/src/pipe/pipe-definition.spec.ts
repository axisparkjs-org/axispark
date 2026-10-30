import { ClassType } from '@axisparkjs/common';
import { ParameterDefinition } from '../parameter';
import { PipeDefinition } from './pipe-definition';
import { PipeStep, PipeStepConfig } from './pipe-step';

describe('PipeDefinition', () => {
    class TestPipeStep implements PipeStep {
        execute(value: unknown): unknown {
            return value;
        }
    }

    class AnotherPipeStep implements PipeStep {
        execute(value: unknown): unknown {
            return value;
        }
    }

    const parameter = {} as ParameterDefinition;

    it('should create a pipe with the given parameter and steps', () => {
        const steps: {
            pipeStep: ClassType<PipeStep>;
            pipeStepConfig?: PipeStepConfig;
        }[] = [
            {
                pipeStep: TestPipeStep
            }
        ];

        const pipe = new PipeDefinition(parameter, steps);

        expect(pipe.parameter).toBe(parameter);
        expect(pipe.steps).toBe(steps);
    });

    it('should create a pipe without steps', () => {
        const steps: {
            pipeStep: ClassType<PipeStep>;
            pipeStepConfig?: PipeStepConfig;
        }[] = [];

        const pipe = new PipeDefinition(parameter, steps);

        expect(pipe.parameter).toBe(parameter);
        expect(pipe.steps).toEqual([]);
    });

    it('should preserve the pipe step configuration', () => {
        const config = {
            // Add the real PipeStepConfig properties here
        } as PipeStepConfig;

        const steps = [
            {
                pipeStep: TestPipeStep,
                pipeStepConfig: config
            }
        ];

        const pipe = new PipeDefinition(parameter, steps);

        expect(pipe.steps).toHaveLength(1);
        expect(pipe.steps[0].pipeStep).toBe(TestPipeStep);
        expect(pipe.steps[0].pipeStepConfig).toBe(config);
    });

    it('should preserve multiple pipe steps and their order', () => {
        const firstConfig = {} as PipeStepConfig;
        const secondConfig = {} as PipeStepConfig;

        const steps = [
            {
                pipeStep: TestPipeStep,
                pipeStepConfig: firstConfig
            },
            {
                pipeStep: AnotherPipeStep,
                pipeStepConfig: secondConfig
            }
        ];

        const pipe = new PipeDefinition(parameter, steps);

        expect(pipe.steps).toHaveLength(2);

        expect(pipe.steps[0]).toEqual({
            pipeStep: TestPipeStep,
            pipeStepConfig: firstConfig
        });

        expect(pipe.steps[1]).toEqual({
            pipeStep: AnotherPipeStep,
            pipeStepConfig: secondConfig
        });
    });

    it('should allow a pipe step without configuration', () => {
        const steps = [
            {
                pipeStep: TestPipeStep
            }
        ];

        const pipe = new PipeDefinition(parameter, steps);

        expect(pipe.steps[0].pipeStep).toBe(TestPipeStep);
        expect(pipe.steps[0].pipeStepConfig).toBeUndefined();
    });
});
