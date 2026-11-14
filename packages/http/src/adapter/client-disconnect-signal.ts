import { ClientDisconnectedError } from '@axisparkjs/engine';

/**
 * The members of a Node.js `ServerResponse` used by `clientDisconnectSignal()`.
 */
export interface ClosableResponse {
    readonly writableFinished: boolean;
    readonly destroyed: boolean;
    once(event: 'close', listener: () => void): unknown;
}

/**
 * Creates a signal that is aborted with a `ClientDisconnectedError` when the connection of a response is closed before the response is sent. It is used by the HTTP adapters to implement `HttpRequest.signal`.
 *
 * The listener is added once to the response, which is created for each request, and runs when the response is closed, so no listener is left on keep-alive connections.
 * @param response The Node.js response of the request.
 * @returns The signal of the client.
 */
export function clientDisconnectSignal(response: ClosableResponse): AbortSignal {
    const controller = new AbortController();
    const abort = () => controller.abort(new ClientDisconnectedError('The client closed the connection before the response was sent'));

    if (response.writableFinished) return controller.signal;
    if (response.destroyed) {
        abort();
        return controller.signal;
    }

    response.once('close', () => {
        if (!response.writableFinished) abort();
    });
    return controller.signal;
}
