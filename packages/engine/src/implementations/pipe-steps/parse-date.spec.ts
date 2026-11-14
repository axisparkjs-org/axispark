import { PipeStepParsingError } from '../../pipe';
import { ParseDate, ParseDatePipeStep } from './parse-date';

describe('ParseDatePipeStep', () => {
    const step = new ParseDatePipeStep();

    it('should return the step and its configuration', () => {
        expect(ParseDate()).toStrictEqual({ pipeStep: ParseDatePipeStep, PipeStepConfig: { dateOnly: undefined } });
    });

    it.each([
        ['2026-03-01', '2026-03-01T00:00:00.000Z'],
        ['2026-03-01T10:30Z', '2026-03-01T10:30:00.000Z'],
        ['2026-03-01T10:30:15Z', '2026-03-01T10:30:15.000Z'],
        ['2026-03-01T10:30:15.250Z', '2026-03-01T10:30:15.250Z'],
        ['2026-03-01T10:30:15+02:00', '2026-03-01T08:30:15.000Z'],
        ['2026-03-01T10:30:15-05:30', '2026-03-01T16:00:15.000Z'],
        ['2024-02-29', '2024-02-29T00:00:00.000Z']
    ])('should parse %s', (value, expected) => {
        expect(step.execute({ value } as any).toISOString()).toBe(expected);
    });

    it('should return valid Date instances', () => {
        const date = new Date();
        expect(step.execute({ value: date } as any)).toBe(date);
    });

    it.each([
        '2026-02-30',
        '2025-02-29',
        '2026-13-01',
        '2026-03-01T10:30:15',
        '2026-03-01T24:00:00Z',
        '2026-03-01T10:60:00Z',
        '2026-03-01T10:30:61Z',
        '2026-03-01T10:30:00+24:00',
        '2026-03-01T10:30:00+02:60',
        '01/03/2026',
        'abc',
        '',
        undefined,
        1
    ])('should throw for %p', (value) => {
        expect(() => step.execute({ parameter: 'query', value } as any)).toThrow(PipeStepParsingError);
    });

    it('should throw for invalid Date instances', () => {
        expect(() => step.execute({ value: new Date('x') } as any)).toThrow(PipeStepParsingError);
    });

    it('should accept only dates with the dateOnly option', () => {
        expect(step.execute({ value: '2026-03-01' } as any, { dateOnly: true }).toISOString()).toBe('2026-03-01T00:00:00.000Z');
        expect(() => step.execute({ parameter: 'query', value: '2026-03-01T10:30:00Z' } as any, { dateOnly: true })).toThrow('(expected YYYY-MM-DD)');
    });
});
