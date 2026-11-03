import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { McpStdioTransport } from './mcp-stdio-transport';

jest.mock('@modelcontextprotocol/server/stdio', () => ({ serveStdio: jest.fn() }));

describe('McpStdioTransport', () => {
    it('should serve the protocol servers through stdio and close the connection', async () => {
        const handle = { close: jest.fn() };
        (serveStdio as jest.Mock).mockReturnValue(handle);
        const server = {};
        const onError = jest.fn();
        const transport = new McpStdioTransport(() => server as any, onError);

        await transport.start();
        const [factory, options] = (serveStdio as jest.Mock).mock.calls[0];
        expect(factory()).toBe(server);
        expect(options).toEqual({ onerror: onError });

        await transport.stop();
        await transport.stop();
        expect(handle.close).toHaveBeenCalledTimes(1);
    });
});
