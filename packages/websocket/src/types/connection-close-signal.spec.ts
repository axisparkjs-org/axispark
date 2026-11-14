import { ClientDisconnectedError } from '@axisparkjs/engine';
import { connectionCloseSignal } from './connection-close-signal';

describe('connectionCloseSignal', () => {
    it('should abort the signal when the connection is closed', () => {
        let close: (() => void) | undefined;
        const signal = connectionCloseSignal(false, (listener) => (close = listener));

        expect(signal.aborted).toBe(false);
        close?.();

        expect(signal.aborted).toBe(true);
        expect(signal.reason).toBeInstanceOf(ClientDisconnectedError);
    });

    it('should return an aborted signal when the connection is already closed', () => {
        const onClose = jest.fn();
        const signal = connectionCloseSignal(true, onClose);

        expect(signal.aborted).toBe(true);
        expect(onClose).not.toHaveBeenCalled();
    });
});
