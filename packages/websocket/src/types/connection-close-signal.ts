import { ClientDisconnectedError } from '@axisparkjs/engine';

/**
 * Creates a signal that is aborted with a `ClientDisconnectedError` when a WebSocket connection is closed. It is used by the WebSocket adapters to implement `WebSocketConnection.signal`.
 * @param closed Whether the connection is already closed, in which case the signal is returned aborted.
 * @param onClose Registers the listener that is called once when the connection is closed.
 * @returns The signal of the connection.
 */
export function connectionCloseSignal(closed: boolean, onClose: (listener: () => void) => void): AbortSignal {
    const controller = new AbortController();
    const abort = () => controller.abort(new ClientDisconnectedError('The client closed the WebSocket connection'));

    if (closed) abort();
    else onClose(abort);

    return controller.signal;
}
