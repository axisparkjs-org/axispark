import { ResultDefinition } from '@axisparkjs/engine';
import { WebSocketContext } from '../../types';
import { WebSocketError } from '../errors';

/**
 * An abstract class for representing WebSocket results.
 */
export abstract class WebSocketResult<T = unknown> extends ResultDefinition<T> {
    public constructor(value: T, rc: number) {
        super(value, rc);
    }

    abstract process(context: WebSocketContext): Promise<void>;
}
/**
 * A class for representing WebSocket results with a body.
 */
export class OkWebSocketResult<T = unknown> extends WebSocketResult<T> {
    public constructor(value: T) {
        super(value, 0);
    }

    public async process(context: WebSocketContext): Promise<void> {
        context.message?.ack?.(this.value);
    }
}

export class ErrorWebSocketResult extends WebSocketResult<WebSocketError> {
    public constructor(error: WebSocketError) {
        super(error, error.status);
    }

    public async process(context: WebSocketContext): Promise<void> {
        context.message?.ack?.({
            error: this.value.response,
            status: this.value.status,
            description: this.value.options?.description,
            ...this.value.details
        });
    }
}
