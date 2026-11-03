import { Catch, Context, ExecutionTransport, Filter, FilteredError, PipeStepError, StepPriority } from '@axisparkjs/engine';
import { McpContext } from '../../types';
import { McpError, McpErrorCode } from '../errors';
import { McpResults } from '../results';

/**
 * A global filter for returning the errors of the MCP handlers to the clients. Validation and parsing errors of the pipes are returned as invalid params.
 */
@Filter({ global: true, transport: ExecutionTransport.Mcp, priority: StepPriority.Base })
export class McpReturnErrorFilter {
    /**
     * Handles errors by returning them as MCP error results.
     * @param error The error to handle.
     * @param context The MCP context of the request.
     * @returns An ErrorMcpResult.
     */
    @Catch(Error)
    public async error(@FilteredError() error: Error, @Context() context: McpContext) {
        if (!(error instanceof McpError)) {
            const code = error instanceof PipeStepError ? McpErrorCode.InvalidParams : McpErrorCode.InternalError;
            error = new McpError(error.message, code, { cause: error, data: { capability: context.request.capability, name: context.request.name } });
        }
        return McpResults.Error(error as McpError);
    }
}
