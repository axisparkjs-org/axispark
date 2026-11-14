import { EventEmitter } from 'node:events';
import { ClientDisconnectedError } from '@axisparkjs/engine';
import { clientDisconnectSignal } from './client-disconnect-signal';

describe('clientDisconnectSignal', () => {
    const response = (state: { writableFinished?: boolean; destroyed?: boolean } = {}) =>
        Object.assign(new EventEmitter(), { writableFinished: false, destroyed: false, ...state });

    it('should abort the signal when the connection is closed before the response is sent', () => {
        const res = response();
        const signal = clientDisconnectSignal(res);

        expect(signal.aborted).toBe(false);
        res.emit('close');

        expect(signal.aborted).toBe(true);
        expect(signal.reason).toBeInstanceOf(ClientDisconnectedError);
        expect(res.listenerCount('close')).toBe(0);
    });

    it('should not abort the signal when the response was sent', () => {
        const res = response();
        const signal = clientDisconnectSignal(res);

        res.writableFinished = true;
        res.emit('close');

        expect(signal.aborted).toBe(false);
        expect(res.listenerCount('close')).toBe(0);
    });

    it('should not listen when the response is already sent', () => {
        const res = response({ writableFinished: true });

        expect(clientDisconnectSignal(res).aborted).toBe(false);
        expect(res.listenerCount('close')).toBe(0);
    });

    it('should return an aborted signal when the connection is already closed', () => {
        const signal = clientDisconnectSignal(response({ destroyed: true }));

        expect(signal.aborted).toBe(true);
        expect(signal.reason).toBeInstanceOf(ClientDisconnectedError);
    });
});
