import { FilteredError as ErrorParam, Filter, Catch, ExecutionTransport, StepPriority } from '@axisparkjs/engine';
import { Context } from '@axisparkjs/engine';
import { WebSocketContext } from '../../types';
import { WebSocketError, WebSocketRequestTimeoutError } from '../errors';
import { WebSocketResults } from '../results';

/**
 * A global filter for returning errors as HTTP responses.
 */
@Filter({ global: true, transport: ExecutionTransport.WebSocket, priority: StepPriority.Base })
export class ReturnErrorFilter {
    /**
     * Handles errors by returning them as WebSocket responses.
     * @param error The error to handle.
     * @returns A promise resolving to an ErrorWebSocketResult.
     */
    @Catch(Error)
    public async error(@ErrorParam() error: Error, @Context() context: WebSocketContext) {
        const description = `Event '${context.message?.event}'`;
        if (!(error instanceof WebSocketError)) {
            error = new WebSocketError(error.message, 1, { cause: error.stack, description });
        } else if (error instanceof WebSocketRequestTimeoutError && !error.options?.description) {
            error = new WebSocketRequestTimeoutError(error.response, { ...error.options, description });
        }
        return WebSocketResults.Error(error as WebSocketError);
    }
}
