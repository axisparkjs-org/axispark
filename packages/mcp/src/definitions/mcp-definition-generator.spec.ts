import 'reflect-metadata';
import { ClassRegistry, ScopedContainerManager } from '@axisparkjs/di';
import { ExecutionTransport } from '@axisparkjs/engine';
import { IsOptional, IsString } from 'class-validator';
import { McpArgs, McpParam } from '../implementations';
import { McpPrompt, McpResource, McpServer, McpTool } from '../decorators';
import { McpSchemaGenerator } from '../schema';
import { McpCapability } from '../types';
import { McpEngine } from '../engine';
import { McpDefinitionGenerator } from './mcp-definition-generator';
import { McpDefinitionError } from './mcp-definition-error';

class SearchDto {
    @IsString() query: string;
}

class PromptDto {
    @IsString() topic: string;
    @IsOptional() @IsString() style?: string;
}

@McpServer({ prefix: 'users' })
class UsersMcp {
    @McpTool('search', { description: 'Search users', title: 'Search', annotations: { readOnlyHint: true } })
    search(@McpArgs() args: SearchDto) {
        return args;
    }

    @McpTool({ inputSchema: { type: 'object', properties: { raw: { type: 'string' } } } })
    raw() {}

    @McpTool()
    untyped(@McpArgs() args: Record<string, unknown>) {
        return args;
    }

    @McpResource('users://{id}', { description: 'User', mimeType: 'application/json' })
    profile(@McpParam('id') id: string) {
        return id;
    }

    @McpPrompt('summary', { description: 'Summary' })
    summary(@McpArgs() args: PromptDto) {
        return args;
    }

    @McpPrompt({ arguments: [{ name: 'custom', required: true }] })
    custom() {}
}

@McpServer()
class RootMcp {
    @McpTool()
    ping() {}

    @McpResource('docs://readme')
    readme() {}
}

describe('McpDefinitionGenerator', () => {
    const createGenerator = (execute = jest.fn()) => {
        const manager = { create: jest.fn().mockReturnValue({ scoped: true }) };
        return {
            execute,
            generator: new McpDefinitionGenerator({ execute } as unknown as McpEngine, manager as unknown as ScopedContainerManager, new McpSchemaGenerator())
        };
    };

    afterEach(() => jest.restoreAllMocks());

    it('should generate the definitions of every MCP server class', async () => {
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([UsersMcp, RootMcp] as any);
        const { tools, resources, prompts } = await createGenerator().generator.generate();

        expect(tools.map((tool) => tool.name)).toEqual(['users.search', 'users.raw', 'users.untyped', 'ping']);
        expect(tools[0]).toMatchObject({
            target: UsersMcp,
            propertyKey: 'search',
            description: 'Search users',
            title: 'Search',
            annotations: { readOnlyHint: true },
            inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
        });
        expect(tools[1].inputSchema).toEqual({ type: 'object', properties: { raw: { type: 'string' } } });
        expect(tools[2].inputSchema).toEqual({ type: 'object' });
        expect(tools[3].inputSchema).toEqual({ type: 'object' });

        expect(resources.map((resource) => [resource.name, resource.uri, resource.isTemplate])).toEqual([
            ['users.profile', 'users://{id}', true],
            ['readme', 'docs://readme', false]
        ]);
        expect(resources[0]).toMatchObject({ description: 'User', mimeType: 'application/json' });

        expect(prompts.map((prompt) => [prompt.name, prompt.arguments])).toEqual([
            [
                'users.summary',
                [
                    { name: 'topic', required: true },
                    { name: 'style', required: false }
                ]
            ],
            ['users.custom', [{ name: 'custom', required: true }]]
        ]);
    });

    it('should add the descriptions of the schema to the prompt arguments', async () => {
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([UsersMcp] as any);
        const generator = createGenerator().generator;
        jest.spyOn(McpSchemaGenerator.prototype, 'generate').mockReturnValue({
            type: 'object',
            properties: { topic: { type: 'string', description: 'The topic' } }
        });

        const { prompts } = await generator.generate();

        expect(prompts[0].arguments).toEqual([{ name: 'topic', required: false, description: 'The topic' }]);
    });

    it('should create handlers that run the requests through the engine', async () => {
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([UsersMcp] as any);
        const execute = jest.fn(async (context) => {
            context.response = { result: { content: [] } };
        });
        const { generator } = createGenerator(execute);
        const { tools } = await generator.generate();
        const input = {
            request: { capability: McpCapability.Tool, name: 'users.search', arguments: { query: 'a' }, params: {} },
            session: { id: undefined, transport: 'http' as const },
            client: undefined
        };

        const response = await tools[0].handler(input);

        expect(response).toEqual({ result: { content: [] } });
        expect(execute).toHaveBeenCalledWith(
            expect.objectContaining({
                ...input,
                definition: tools[0],
                target: UsersMcp,
                propertyKey: 'search',
                scopedContainer: { scoped: true },
                transport: ExecutionTransport.Mcp,
                error: undefined
            })
        );
    });

    it('should pass the definition of resources and prompts to their handlers', async () => {
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([UsersMcp] as any);
        const { execute, generator } = createGenerator();
        const { resources, prompts } = await generator.generate();
        const session = { id: undefined, transport: 'stdio' as const };

        expect(
            await resources[0].handler({
                request: { capability: McpCapability.Resource, name: 'users.profile', arguments: {}, params: { id: '1' } },
                session,
                client: undefined
            })
        ).toBeUndefined();
        await prompts[0].handler({
            request: { capability: McpCapability.Prompt, name: 'users.summary', arguments: {}, params: {} },
            session,
            client: undefined
        });

        expect(execute.mock.calls[0][0]).toMatchObject({ definition: resources[0], propertyKey: 'profile' });
        expect(execute.mock.calls[1][0]).toMatchObject({ definition: prompts[0], propertyKey: 'summary' });
    });

    it('should reject duplicated names and URIs', async () => {
        @McpServer({ prefix: 'users' })
        class DuplicatedMcp {
            @McpTool()
            search() {}
        }
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([UsersMcp, DuplicatedMcp] as any);

        await expect(createGenerator().generator.generate()).rejects.toThrow(
            new McpDefinitionError("Duplicate MCP tool name 'users.search' in UsersMcp.search and DuplicatedMcp.search")
        );
    });

    it('should return no definitions without MCP server classes', async () => {
        jest.spyOn(ClassRegistry, 'getWithMetadata').mockReturnValue([class Empty {}] as any);

        expect(await createGenerator().generator.generate()).toEqual({ tools: [], resources: [], prompts: [] });
    });
});
