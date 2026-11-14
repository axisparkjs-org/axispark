import { Default, DefaultPipeStep } from './default';

describe('DefaultPipeStep', () => {
    const step = new DefaultPipeStep();

    it('should return the step and its configuration', () => {
        expect(Default(1)).toStrictEqual({ pipeStep: DefaultPipeStep, PipeStepConfig: { value: 1, emptyString: undefined } });
        expect(Default('a', { emptyString: true })).toStrictEqual({ pipeStep: DefaultPipeStep, PipeStepConfig: { value: 'a', emptyString: true } });
    });

    it('should return the default value when the parameter is undefined', () => {
        expect(step.execute({ value: undefined } as any, { value: 1 })).toBe(1);
    });

    it('should keep the value of the parameter when it is defined', () => {
        expect(step.execute({ value: '5' } as any, { value: 1 })).toBe('5');
        expect(step.execute({ value: null } as any, { value: 1 })).toBeNull();
        expect(step.execute({ value: 0 } as any, { value: 1 })).toBe(0);
    });

    it('should replace empty strings only with the emptyString option', () => {
        expect(step.execute({ value: '' } as any, { value: 'x' })).toBe('');
        expect(step.execute({ value: '' } as any, { value: 'x', emptyString: true })).toBe('x');
    });

    it('should return a copy of objects and arrays', () => {
        const value = { tags: ['a'] };
        const result = step.execute({ value: undefined } as any, { value });

        expect(result).toEqual(value);
        expect(result).not.toBe(value);
        expect(result.tags).not.toBe(value.tags);
    });

    it('should return the same value when it cannot be copied', () => {
        const value = { run: () => 1 };
        expect(step.execute({ value: undefined } as any, { value })).toBe(value);
    });
});
