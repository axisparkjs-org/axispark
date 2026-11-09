import { TimeoutResolver, TimeoutDefinition } from '@axisparkjs/engine';
import { Inject, Injectable } from '@axisparkjs/di';
import { WebSocketRequestTimeoutError } from '../errors';
import { WEBSOCKET_OPTIONS } from '../../di/tokens';
import { WebSocketPluginOptions, WebSocketTimeoutOptions } from '../../plugin/websocket-plugin-options';

/**
 * A resolver for handling WebSocket event timeouts. It throws a `WebSocketRequestTimeoutError` with the configured message when a timeout occurs.
 */
@Injectable()
export class WebSocketTimeoutResolver implements TimeoutResolver {
    private readonly options: WebSocketTimeoutOptions | undefined;

    constructor(@Inject(WEBSOCKET_OPTIONS) options?: WebSocketPluginOptions) {
        this.options = options?.timeoutOptions;
    }

    public async resolve(timeout: TimeoutDefinition): Promise<void> {
        const message = this.options?.message;
        throw new WebSocketRequestTimeoutError(
            typeof message === 'function' ? message(timeout.time) : message || 'Request timed out after ' + timeout.time + 'ms'
        );
    }
}
