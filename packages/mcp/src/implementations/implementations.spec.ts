import { ParameterDefinition, PipeStepValidationError, TimeoutDefinition } from '@axisparkjs/engine';
import { McpCapability, McpContext } from '../types';
import { McpError, McpErrorCode } from './errors';
import { McpReturnErrorFilter } from './filters';
import { McpArgsResolver, McpContextResolver, McpParamResolver, McpSessionResolver } from './parameters';
import { ErrorMcpResult, McpResultResolver, McpResults, OkMcpResult } from './results';
import { McpTimeoutResolver } from './timeouts';

const context = (capability = McpCapability.Tool): McpContext =>
    ({
        request: { capability, name: 'search', arguments: { query: 'a' }, params: { id: '1' } },
        session: { id: 's', transport: 'http' },
        client: undefined,
        definition: { description: undefined }
    }) as unknown as McpContext;

describe('McpError', () => {
    it('should default to an internal error and keep its cause', () => {
        const cause = new Error('cause');
        const error = new McpError('failed', McpErrorCode.InvalidParams, { cause, data: { a: 1 } });

        expect(error).toMatchObject({ name: 'McpError', message: 'failed', code: -32602, options: { data: { a: 1 } } });
        expect(error.cause).toBe(cause);
        expect(new McpError('failed').code).toBe(McpErrorCode.InternalError);
        expect(new McpError('failed').cause).toBeUndefined();
    });
});

describe('MCP parameter resolvers', () => {
    it('should resolve the arguments, params, session and context', () => {
        const ctx = context();

        expect(new McpArgsResolver().resolve(ctx)).toEqual({ query: 'a' });
        expect(new McpParamResolver().resolve(ctx, { field: 'id' } as ParameterDefinition)).toBe('1');
        expect(new McpParamResolver().resolve(ctx, {} as ParameterDefinition)).toEqual({ id: '1' });
        expect(new McpSessionResolver().resolve(ctx)).toBe(ctx.session);
        expect(new McpContextResolver().resolve(ctx)).toBe(ctx);
    });
});

describe('McpResultResolver', () => {
    it('should resolve every value into an OkMcpResult', () => {
        expect(new McpResultResolver().resolve('value')).toBeInstanceOf(OkMcpResult);
        expect(new McpResultResolver().resolve(undefined)).toBeInstanceOf(OkMcpResult);
    });
});

describe('McpTimeoutResolver', () => {
    it('should throw an McpError', async () => {
        await expect(new McpTimeoutResolver().resolve(new TimeoutDefinition(10))).rejects.toThrow(new McpError('Request timed out after 10ms'));
    });
});

describe('McpReturnErrorFilter', () => {
    const filter = new McpReturnErrorFilter();

    it('should keep McpErrors', async () => {
        const error = new McpError('custom', McpErrorCode.InvalidRequest);
        const result = await filter.error(error, context());

        expect(result).toBeInstanceOf(ErrorMcpResult);
        expect(result.value).toBe(error);
        expect(result.rc).toBe(McpErrorCode.InvalidRequest);
    });

    it('should convert pipe errors into invalid params and other errors into internal errors', async () => {
        const validation = await filter.error(new PipeStepValidationError({ parameter: 'mcp-args' } as ParameterDefinition, 'bad'), context());
        const other = await filter.error(new Error('boom'), context(McpCapability.Prompt));

        expect(validation.value).toMatchObject({ code: McpErrorCode.InvalidParams, message: "Validation failed for 'mcp-args': bad" });
        expect(other.value).toMatchObject({ code: McpErrorCode.InternalError, message: 'boom', options: { data: { capability: 'prompt', name: 'search' } } });
    });

    it('should create error results from a message', () => {
        expect(McpResults.Error('message').value).toEqual(new McpError('message'));
    });
});
