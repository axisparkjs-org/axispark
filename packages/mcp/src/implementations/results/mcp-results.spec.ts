import { McpCapability, McpContext } from '../../types';
import { McpError, McpErrorCode } from '../errors';
import { McpResults } from './mcp-results';
import { toBase64 } from './mcp-result-converter';

const context = (capability: McpCapability, definition: Record<string, unknown> = {}, uri?: string): McpContext =>
    ({
        request: { capability, name: 'thing', uri, arguments: {}, params: {} },
        definition
    }) as unknown as McpContext;

const process = async (result: { process(context: McpContext): Promise<void> }, ctx: McpContext) => {
    await result.process(ctx);
    return ctx.response;
};

describe('McpResults', () => {
    describe('tools', () => {
        const tool = () => context(McpCapability.Tool);

        it('should convert the returned values', async () => {
            expect(await process(McpResults.Ok(undefined), tool())).toEqual({ result: { content: [] } });
            expect(await process(McpResults.Ok(null), tool())).toEqual({ result: { content: [] } });
            expect(await process(McpResults.Ok('hello'), tool())).toEqual({ result: { content: [{ type: 'text', text: 'hello' }] } });
            expect(await process(McpResults.Ok({ a: 1 }), tool())).toEqual({
                result: { content: [{ type: 'text', text: '{"a":1}' }], structuredContent: { a: 1 } }
            });
            expect(await process(McpResults.Ok([1, 2]), tool())).toEqual({ result: { content: [{ type: 'text', text: '[1,2]' }] } });
            expect(await process(McpResults.Ok(42), tool())).toEqual({ result: { content: [{ type: 'text', text: '42' }] } });
            expect(
                await process(
                    McpResults.Ok(() => 1),
                    tool()
                )
            ).toEqual({ result: { content: [{ type: 'text', text: '() => 1' }] } });
            expect(await process(McpResults.Ok(Buffer.from('bin')), tool())).toEqual({
                result: {
                    content: [{ type: 'resource', resource: { uri: 'tool://thing', mimeType: 'application/octet-stream', blob: toBase64(Buffer.from('bin')) } }]
                }
            });
        });

        it('should create content results', async () => {
            expect(await process(McpResults.Text('text'), tool())).toEqual({ result: { content: [{ type: 'text', text: 'text' }] } });
            expect(await process(McpResults.Json({ b: 2 }), tool())).toEqual({
                result: { content: [{ type: 'text', text: '{"b":2}' }], structuredContent: { b: 2 } }
            });
            expect(await process(McpResults.Json([1]), tool())).toEqual({ result: { content: [{ type: 'text', text: '[1]' }] } });
            expect(await process(McpResults.Json(undefined), tool())).toEqual({ result: { content: [{ type: 'text', text: 'undefined' }] } });
            expect(await process(McpResults.Image('aGk=', 'image/png'), tool())).toEqual({
                result: { content: [{ type: 'image', data: 'aGk=', mimeType: 'image/png' }] }
            });
            expect(await process(McpResults.Audio(Buffer.from('hi'), 'audio/wav'), tool())).toEqual({
                result: { content: [{ type: 'audio', data: 'aGk=', mimeType: 'audio/wav' }] }
            });
            expect(await process(McpResults.Resource('a://1', 'text', 'text/plain'), tool())).toEqual({
                result: { content: [{ type: 'resource', resource: { uri: 'a://1', mimeType: 'text/plain', text: 'text' } }] }
            });
            expect(await process(McpResults.Resource('a://1', Buffer.from('hi')), tool())).toEqual({
                result: { content: [{ type: 'resource', resource: { uri: 'a://1', mimeType: undefined, blob: 'aGk=' } }] }
            });
            expect(await process(McpResults.ResourceLink('a://1', 'one', { description: 'One' }), tool())).toEqual({
                result: { content: [{ type: 'resource_link', uri: 'a://1', name: 'one', description: 'One' }] }
            });
            expect(await process(McpResults.ResourceLink('a://1', 'one'), tool())).toEqual({
                result: { content: [{ type: 'resource_link', uri: 'a://1', name: 'one' }] }
            });
            expect(await process(McpResults.Content([{ type: 'text', text: 'a' }], { a: 1 }), tool())).toEqual({
                result: { content: [{ type: 'text', text: 'a' }], structuredContent: { a: 1 } }
            });
            expect(await process(McpResults.Messages([{ role: 'assistant', content: { type: 'text', text: 'm' } }]), tool())).toEqual({
                result: { content: [{ type: 'text', text: 'm' }] }
            });
            expect(await process(McpResults.Raw({ content: [], custom: true }), tool())).toEqual({ result: { content: [], custom: true } });
        });

        it('should return errors as tool results', async () => {
            expect(await process(McpResults.Error(new McpError('failed')), tool())).toEqual({
                result: { content: [{ type: 'text', text: 'failed' }], isError: true }
            });
        });
    });

    describe('prompts', () => {
        it('should convert the returned values into user messages', async () => {
            expect(await process(McpResults.Ok('hello'), context(McpCapability.Prompt, { description: 'Prompt' }))).toEqual({
                result: { description: 'Prompt', messages: [{ role: 'user', content: { type: 'text', text: 'hello' } }] }
            });
            expect(await process(McpResults.Ok(undefined), context(McpCapability.Prompt))).toEqual({ result: { messages: [] } });
        });

        it('should create message results', async () => {
            const messages = [{ role: 'assistant' as const, content: { type: 'text' as const, text: 'm' } }];

            expect(await process(McpResults.Messages(messages, 'Custom'), context(McpCapability.Prompt, { description: 'Prompt' }))).toEqual({
                result: { description: 'Custom', messages }
            });
        });

        it('should return errors as protocol errors', async () => {
            const error = new McpError('failed', McpErrorCode.InvalidParams);

            expect(await process(McpResults.Error(error), context(McpCapability.Prompt))).toEqual({ error });
        });
    });

    describe('resources', () => {
        const resource = (mimeType?: string) => context(McpCapability.Resource, { mimeType }, 'users://1');

        it('should convert the returned values into resource contents', async () => {
            expect(await process(McpResults.Ok(undefined), resource())).toEqual({ result: { contents: [] } });
            expect(await process(McpResults.Ok('text'), resource())).toEqual({
                result: { contents: [{ uri: 'users://1', mimeType: 'text/plain', text: 'text' }] }
            });
            expect(await process(McpResults.Ok('# Title'), resource('text/markdown'))).toEqual({
                result: { contents: [{ uri: 'users://1', mimeType: 'text/markdown', text: '# Title' }] }
            });
            expect(await process(McpResults.Ok(Buffer.from('hi')), resource())).toEqual({
                result: { contents: [{ uri: 'users://1', mimeType: 'application/octet-stream', blob: 'aGk=' }] }
            });
            expect(await process(McpResults.Ok({ id: 1 }), resource())).toEqual({
                result: { contents: [{ uri: 'users://1', mimeType: 'application/json', text: '{"id":1}' }] }
            });
            expect(await process(McpResults.Ok(Symbol.iterator), resource())).toEqual({
                result: { contents: [{ uri: 'users://1', mimeType: 'application/json', text: 'Symbol(Symbol.iterator)' }] }
            });
        });

        it('should convert content blocks into resource contents', async () => {
            const result = McpResults.Content([
                { type: 'text', text: 'text' },
                { type: 'image', data: 'aGk=', mimeType: 'image/png' },
                { type: 'resource', resource: { uri: 'other://1', text: 'other' } },
                { type: 'resource_link', uri: 'link://1', name: 'link' }
            ]);

            expect(await process(result, resource('text/csv'))).toEqual({
                result: {
                    contents: [
                        { uri: 'users://1', mimeType: 'text/csv', text: 'text' },
                        { uri: 'users://1', mimeType: 'image/png', blob: 'aGk=' },
                        { uri: 'other://1', text: 'other' }
                    ]
                }
            });
            expect(await process(McpResults.Text('plain'), resource())).toEqual({
                result: { contents: [{ uri: 'users://1', mimeType: 'text/plain', text: 'plain' }] }
            });
        });

        it('should convert the content of prompt messages', async () => {
            expect(await process(McpResults.Messages([{ role: 'user', content: { type: 'text', text: 'm' } }]), resource())).toEqual({
                result: { contents: [{ uri: 'users://1', mimeType: 'text/plain', text: 'm' }] }
            });
        });

        it('should use the definition without a MIME type', async () => {
            const ctx = {
                request: { capability: McpCapability.Resource, name: 'r', uri: 'r://1', arguments: {}, params: {} },
                definition: {}
            } as unknown as McpContext;
            delete (ctx.definition as unknown as Record<string, unknown>).mimeType;

            expect(await process(McpResults.Text('t'), ctx)).toEqual({ result: { contents: [{ uri: 'r://1', mimeType: 'text/plain', text: 't' }] } });
            expect(await process(McpResults.Ok('t'), ctx)).toEqual({ result: { contents: [{ uri: 'r://1', mimeType: 'text/plain', text: 't' }] } });
        });
    });
});
