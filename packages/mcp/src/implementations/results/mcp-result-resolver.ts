import { Injectable } from '@axisparkjs/di';
import { ResultDefinition, ResultResolver } from '@axisparkjs/engine';
import { OkMcpResult } from './mcp-result';

/**
 * A resolver for creating MCP results from the values returned by the handlers.
 */
@Injectable()
export class McpResultResolver implements ResultResolver {
    /**
     * Resolves an unknown value into an MCP result.
     * @param result The value returned by the handler.
     * @returns The MCP result.
     */
    public resolve(result: unknown): ResultDefinition {
        return new OkMcpResult(result);
    }
}
