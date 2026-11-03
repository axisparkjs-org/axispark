import { ExecutionContext, Parameter } from '@axisparkjs/engine';
import { McpRequest } from './mcp-request';
import { McpSession } from './mcp-session';
import { McpClientInfo } from './mcp-client-info';
import { McpResponse } from './mcp-response';
import { McpParameter } from './mcp-parameter';
import type { McpCapabilityDefinition } from '../definitions/mcp-capability-definition';

/**
 * Represents the context of an MCP request. Extends the ExecutionContext from the engine module.
 */
export interface McpContext extends ExecutionContext {
    /** The request being handled. */
    request: McpRequest;
    /** The session or connection that carries the request. */
    session: McpSession;
    /** The client that sent the request, if it declared itself. */
    client: McpClientInfo | undefined;
    /** The definition of the tool, resource or prompt that handles the request. */
    definition: McpCapabilityDefinition;
    /** The outcome of the request, set when the result of the handler is processed. */
    response?: McpResponse;
}

/**
 * A parameter decorator for injecting the {@link McpContext} of the current request.
 * @returns A parameter decorator.
 */
export const McpContext = () => Parameter(McpParameter.Context);
