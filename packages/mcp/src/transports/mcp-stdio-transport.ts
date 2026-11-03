import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { McpServerProvider, McpTransport } from './mcp-transport';

type StdioServerHandle = ReturnType<typeof serveStdio>;

/**
 * An MCP transport that communicates with a client through the standard input and output of the process. Nothing else may write to the standard output while it is running.
 */
export class McpStdioTransport implements McpTransport {
    private handle?: StdioServerHandle;

    constructor(
        private readonly provider: McpServerProvider,
        private readonly onError?: (error: Error) => void
    ) {}

    async start(): Promise<void> {
        this.handle = serveStdio(() => this.provider(), { onerror: this.onError });
    }

    async stop(): Promise<void> {
        await this.handle?.close();
        this.handle = undefined;
    }
}
