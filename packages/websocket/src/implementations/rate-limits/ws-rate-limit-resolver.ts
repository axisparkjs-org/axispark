import { Inject, Injectable } from '@axisparkjs/di';
import { ExecutionContext, RateLimitResolver } from '@axisparkjs/engine';
import { WEBSOCKET_OPTIONS } from '../../di/tokens';
import { WebSocketPluginOptions } from '../../plugin/websocket-plugin-options';
import { WebSocketContext } from '../../types';

/**
 * Identifies the WebSocket clients with the `rateLimitOptions.by` option of the plugin. `RateLimitProcessor` counts the events per client
 * and handler:
 *
 * - `'address'` (default): the remote address of the connection, falling back to the connection id when the adapter does not know it.
 *   Reconnecting does not reset the limits.
 * - `'connection'`: the connection id, which changes on every reconnection.
 * - A function, for example to count the events per authenticated user.
 */
@Injectable()
export class WsRateLimitResolver implements RateLimitResolver {
    constructor(@Inject(WEBSOCKET_OPTIONS) private readonly options: WebSocketPluginOptions) {}

    public async resolve(context: ExecutionContext): Promise<string | undefined> {
        const webSocketContext = context as WebSocketContext;
        const by = this.options.rateLimitOptions?.by ?? 'address';
        if (typeof by === 'function') return await by(webSocketContext);

        const connection = webSocketContext.connection;
        if (by === 'connection') return connection?.id;
        return connection?.remoteAddress ?? connection?.id;
    }
}
