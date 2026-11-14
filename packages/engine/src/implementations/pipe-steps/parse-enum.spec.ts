import { PipeStepParsingError } from '../../pipe';
import { enumValues, ParseEnum, ParseEnumPipeStep } from './parse-enum';

enum OrderStatus {
    Open = 'open',
    Closed = 'closed'
}

enum Priority {
    Low,
    High = 5
}

describe('ParseEnumPipeStep', () => {
    const step = new ParseEnumPipeStep();
    const run = (value: unknown, enumOrValues: any, options?: { ignoreCase?: boolean }) =>
        step.execute({ parameter: 'query', value } as any, ParseEnum(enumOrValues, options).PipeStepConfig);

    it('should return the step and the values of the enum', () => {
        expect(ParseEnum(OrderStatus)).toStrictEqual({ pipeStep: ParseEnumPipeStep, PipeStepConfig: { values: ['open', 'closed'], ignoreCase: undefined } });
    });

    it('should list the values of enums and arrays', () => {
        expect(enumValues(OrderStatus)).toEqual(['open', 'closed']);
        expect(enumValues(Priority)).toEqual([0, 5]);
        expect(enumValues(['a', 'b'])).toEqual(['a', 'b']);
    });

    it('should accept the values of a string enum', () => {
        expect(run('open', OrderStatus)).toBe(OrderStatus.Open);
    });

    it('should return the numeric value of a numeric enum', () => {
        expect(run('5', Priority)).toBe(Priority.High);
        expect(run(0, Priority)).toBe(Priority.Low);
    });

    it('should accept the values of an array', () => {
        expect(run('b', ['a', 'b'])).toBe('b');
    });

    it('should compare without case with the ignoreCase option', () => {
        expect(run('OPEN', OrderStatus, { ignoreCase: true })).toBe(OrderStatus.Open);
        expect(() => run('OPEN', OrderStatus)).toThrow(PipeStepParsingError);
    });

    it('should list the allowed values in the error', () => {
        expect(() => run('pending', OrderStatus)).toThrow(
            "Parsing failed for 'query' as enum: Value 'pending' is not one of the allowed values: open, closed."
        );
    });

    it('should reject names of numeric enums and other types', () => {
        expect(() => run('High', Priority)).toThrow(PipeStepParsingError);
        expect(() => run(undefined, OrderStatus)).toThrow(PipeStepParsingError);
        expect(() => run({}, OrderStatus)).toThrow(PipeStepParsingError);
    });
});
