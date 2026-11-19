import { Signal, SignalName, SignalResolver } from './signal';
import { Parameter } from '../../decorators';

jest.mock('../../decorators', () => ({
    Parameter: jest.fn()
}));

describe('Signal', () => {
    it('should call Parameter with SignalName', () => {
        Signal();

        expect(Parameter).toHaveBeenCalledWith(SignalName);
    });
});

describe('SignalResolver', () => {
    it('should return the signal of the execution context', () => {
        const signal = new AbortController().signal;

        expect(new SignalResolver().resolve({ signal } as any)).toBe(signal);
    });
});
