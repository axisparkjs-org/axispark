import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { McpContext } from './mcp-context';
import { McpParameter } from './mcp-parameter';
import { McpSession } from './mcp-session';

describe('MCP parameter decorators', () => {
    it('should define the session and context parameters', () => {
        class Handler {
            handle(@McpSession() _session: McpSession, @McpContext() _context: McpContext) {}
        }

        expect(
            Metadata.get<{ parameter: string }[]>(MetadataKeys.PARAMETER, Handler, 'handle')
                ?.map((parameter) => parameter.parameter)
                .sort()
        ).toEqual([McpParameter.Context, McpParameter.Session].sort());
    });
});
