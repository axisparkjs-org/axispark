import { Executable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { ExecutionEngine } from '@axisparkjs/engine';
import { McpContext } from '../types';

/**
 * A class for running MCP requests through the execution engine.
 */
@Injectable()
export class McpEngine implements Executable {
    constructor(private readonly executionEngine: ExecutionEngine) {}

    /**
     * Executes the MCP request of the provided context.
     * @param context The MCP context for execution.
     */
    public async execute(context: McpContext): Promise<void> {
        await this.executionEngine.execute(context);
    }
}
