import { FilteredError as ErrorParam, Filter, Catch, ExecutionTransport, StepPriority } from '@axisparkjs/engine';
import { Context } from '@axisparkjs/engine';
import { WebSocketContext } from '../../types';
import { WebSocketError } from '../errors';
import { WebSocketResults } from '../results';

/**
 * A global filter for returning errors as WebSocket responses through the acknowledgement.
 */
@Filter({ global: true, transport: ExecutionTransport.WebSocket, priority: StepPriority.Base })
export class WebSocketReturnErrorFilter {
    /**
     * Handles errors by returning them as WebSocket responses.
     * @param error The error to handle.
     * @returns A promise resolving to an ErrorWebSocketResult.
     */
    @Catch(Error)
    public async error(@ErrorParam() error: Error, @Context() context: WebSocketContext) {
        if (!(error instanceof WebSocketError)) {
            error = new WebSocketError(error.message, 1, { cause: error.stack, description: `Event '${context.message?.event}'` });
        }
        return WebSocketResults.Error(error as WebSocketError);
    }
}
