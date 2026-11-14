import { PipeStepSkip } from '../../pipe';
import { Optional, OptionalPipeStep } from './optional';

describe('OptionalPipeStep', () => {
    const step = new OptionalPipeStep();

    it('should return the step and its configuration', () => {
        expect(Optional()).toStrictEqual({ pipeStep: OptionalPipeStep, PipeStepConfig: { emptyString: undefined } });
    });

    it('should skip the pipe when the parameter is undefined', () => {
        expect(step.execute({ value: undefined } as any)).toBe(PipeStepSkip);
    });

    it('should keep the value of the parameter when it is defined', () => {
        expect(step.execute({ value: 'a' } as any)).toBe('a');
        expect(step.execute({ value: '' } as any)).toBe('');
    });

    it('should skip empty strings with the emptyString option', () => {
        expect(step.execute({ value: '' } as any, { emptyString: true })).toBe(PipeStepSkip);
    });
});
