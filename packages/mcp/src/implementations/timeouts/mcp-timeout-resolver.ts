import { Injectable } from '@axisparkjs/di';
import { TimeoutDefinition, TimeoutResolver } from '@axisparkjs/engine';
import { McpError } from '../errors';

/**
 * A resolver for handling MCP request timeouts. It throws an McpError when a timeout occurs.
 */
@Injectable()
export class McpTimeoutResolver implements TimeoutResolver {
    public async resolve(timeout: TimeoutDefinition): Promise<void> {
        throw new McpError('Request timed out after ' + timeout.time + 'ms');
    }
}
