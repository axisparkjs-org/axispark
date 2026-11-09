import { errorType, secondsSince } from './telemetry-names';

describe('telemetry names', () => {
    it('returns the class of an error as its type', () => {
        class PaymentError extends Error {}

        expect(errorType(new PaymentError('declined'))).toBe('PaymentError');
        expect(errorType(Object.assign(Object.create(null), { name: 'Plain' }))).toBe('_OTHER');
        expect(errorType(Object.assign(new Error('x'), { constructor: undefined }))).toBe('Error');
    });

    it('returns the seconds since a performance time', () => {
        jest.spyOn(performance, 'now').mockReturnValue(2_500);

        expect(secondsSince(1_000)).toBe(1.5);
    });
});
