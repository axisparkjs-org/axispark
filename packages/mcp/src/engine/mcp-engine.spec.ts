import { McpEngine } from './mcp-engine';

describe('McpEngine', () => {
    it('should execute the context through the execution engine', async () => {
        const executionEngine = { execute: jest.fn() };
        const context = { request: {} } as any;

        await new McpEngine(executionEngine as any).execute(context);

        expect(executionEngine.execute).toHaveBeenCalledWith(context);
    });
});
