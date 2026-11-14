import { Injector } from '@axisparkjs/di';
import { PipeStepParsingError, PipeStepValidationError } from '../../pipe';
import { ParameterDefinition } from '../../parameter';
import { ParseArray, ParseArrayPipeStep } from './parse-array';
import { ParseIntPipeStep, ParseInt } from './parse-int';
import { OptionalPipeStep } from './optional';
import { TrimPipeStep } from './trim';

describe('ParseArrayPipeStep', () => {
    const injector = { get: jest.fn(async (type: new () => unknown) => new type()) } as unknown as Injector;
    const step = new ParseArrayPipeStep(injector);
    const parameter = (value: unknown) => {
        const definition = ParameterDefinition.fromMetadata({
            target: class Target {},
            propertyKey: 'list',
            parameterIndex: 0,
            parameter: 'query',
            field: 'tags'
        });
        definition.setValue(value);
        return definition;
    };

    it('should return the step and its configuration', () => {
        expect(ParseArray()).toStrictEqual({ pipeStep: ParseArrayPipeStep, PipeStepConfig: {} });
        expect(ParseArray({ separator: ';' })).toStrictEqual({ pipeStep: ParseArrayPipeStep, PipeStepConfig: { separator: ';' } });
    });

    it('should split comma-separated strings', async () => {
        await expect(step.execute(parameter('a, b,,c'))).resolves.toEqual(['a', 'b', 'c']);
    });

    it('should return an array for a single value', async () => {
        await expect(step.execute(parameter('a'))).resolves.toEqual(['a']);
        await expect(step.execute(parameter(1))).resolves.toEqual([1]);
        await expect(step.execute(parameter(''))).resolves.toEqual([]);
    });

    it('should split the strings of arrays', async () => {
        await expect(step.execute(parameter(['a,b', 'c', 2]))).resolves.toEqual(['a', 'b', 'c', 2]);
    });

    it('should use a custom separator', async () => {
        await expect(step.execute(parameter('a;b'), { separator: ';' })).resolves.toEqual(['a', 'b']);
    });

    it('should throw for missing values', async () => {
        await expect(step.execute(parameter(undefined))).rejects.toThrow(PipeStepParsingError);
        await expect(step.execute(parameter(null))).rejects.toThrow(PipeStepParsingError);
    });

    it('should apply the items step to each item', async () => {
        const context = { scopedContainer: {} } as any;
        await expect(step.execute(parameter('1,2,3'), { items: ParseInt() }, context)).resolves.toEqual([1, 2, 3]);
        expect(injector.get).toHaveBeenCalledWith(ParseIntPipeStep, context.scopedContainer);
    });

    it('should accept steps given as classes', async () => {
        await expect(step.execute(parameter(['a']), { items: TrimPipeStep })).resolves.toEqual(['a']);
        await expect(step.execute(parameter(['a']), { items: OptionalPipeStep })).resolves.toEqual(['a']);
    });

    it('should return undefined for the items skipped by the items step', async () => {
        await expect(step.execute(parameter([undefined]), { items: OptionalPipeStep })).resolves.toEqual([undefined]);
    });

    it('should throw the errors of the items step', async () => {
        await expect(step.execute(parameter('1,x'), { items: ParseInt() })).rejects.toThrow(PipeStepParsingError);
    });

    it('should validate the number of items', async () => {
        await expect(step.execute(parameter('a'), { minItems: 2 })).rejects.toThrow("Validation failed for 'query': Array must have at least 2 items.");
        await expect(step.execute(parameter('a,b,c'), { maxItems: 2 })).rejects.toThrow('Array must have at most 2 items.');
        await expect(step.execute(parameter('a,b'), { minItems: 1, maxItems: 2 })).resolves.toEqual(['a', 'b']);
    });

    it('should validate that the items are unique', async () => {
        await expect(step.execute(parameter('a,b,a'), { unique: true })).rejects.toThrow(PipeStepValidationError);
        await expect(step.execute(parameter('1,01'), { unique: true, items: ParseInt() })).rejects.toThrow('Array items must be unique.');
        await expect(step.execute(parameter([new Date(1), new Date(1)]), { unique: true })).rejects.toThrow(PipeStepValidationError);
        await expect(step.execute(parameter('a,b'), { unique: true })).resolves.toEqual(['a', 'b']);
    });
});
