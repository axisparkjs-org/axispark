/**
 * The reason of the execution signal when the client stops waiting for the response: the HTTP connection is closed before the response is sent, or the WebSocket connection is closed while the event is being handled.
 */
export class ClientDisconnectedError extends Error {
    public constructor(message = 'The client disconnected before the execution finished') {
        super(message);
        this.name = 'ClientDisconnectedError';
    }
}
