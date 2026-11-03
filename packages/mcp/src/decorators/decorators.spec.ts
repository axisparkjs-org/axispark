import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { McpPrompt } from './mcp-prompt';
import { McpResource } from './mcp-resource';
import { McpServer } from './mcp-server';
import { McpTool } from './mcp-tool';

describe('MCP decorators', () => {
    it('should define the server metadata and make the class injectable', () => {
        @McpServer({ prefix: 'users' })
        class UsersMcp {}
        @McpServer()
        class OtherMcp {}

        expect(Metadata.get(MetadataKeys.MCP_SERVER, UsersMcp)).toEqual({ target: UsersMcp, prefix: 'users' });
        expect(Metadata.get(MetadataKeys.MCP_SERVER, OtherMcp)).toEqual({ target: OtherMcp, prefix: undefined });
        expect(Metadata.has(MetadataKeys.INJECTABLE, UsersMcp)).toBe(true);
    });

    it('should define tools with a name, options or the method name', () => {
        class Tools {
            @McpTool('search', { description: 'Search' })
            first() {}
            @McpTool({ description: 'Second', title: 'Second tool' })
            second() {}
            @McpTool()
            third() {}
            @McpTool(undefined, { description: 'Fourth' })
            fourth() {}
        }

        const tools = Metadata.get<any[]>(MetadataKeys.MCP_TOOL, Tools);
        expect(tools).toEqual([
            { target: Tools, propertyKey: 'first', name: 'search', description: 'Search' },
            { target: Tools, propertyKey: 'second', name: 'second', description: 'Second', title: 'Second tool' },
            { target: Tools, propertyKey: 'third', name: 'third' },
            { target: Tools, propertyKey: 'fourth', name: 'fourth', description: 'Fourth' }
        ]);
        expect(Metadata.get(MetadataKeys.MCP_TOOL, Tools, 'first')).toEqual(tools?.[0]);
    });

    it('should define resources with their URI and options', () => {
        class Resources {
            @McpResource('users://{id}', { description: 'User', mimeType: 'application/json' })
            profile() {}
            @McpResource('config://app', { name: 'config' })
            config() {}
            @McpResource('docs://readme')
            readme() {}
        }

        expect(Metadata.get(MetadataKeys.MCP_RESOURCE, Resources)).toEqual([
            { target: Resources, propertyKey: 'profile', uri: 'users://{id}', name: 'profile', description: 'User', mimeType: 'application/json' },
            { target: Resources, propertyKey: 'config', uri: 'config://app', name: 'config' },
            { target: Resources, propertyKey: 'readme', uri: 'docs://readme', name: 'readme' }
        ]);
    });

    it('should define prompts with a name, options or the method name', () => {
        class Prompts {
            @McpPrompt('welcome', { description: 'Welcome' })
            first() {}
            @McpPrompt({ arguments: [{ name: 'topic' }] })
            second() {}
            @McpPrompt()
            third() {}
            @McpPrompt('fourth')
            fourth() {}
        }

        expect(Metadata.get(MetadataKeys.MCP_PROMPT, Prompts)).toEqual([
            { target: Prompts, propertyKey: 'first', name: 'welcome', description: 'Welcome' },
            { target: Prompts, propertyKey: 'second', name: 'second', arguments: [{ name: 'topic' }] },
            { target: Prompts, propertyKey: 'third', name: 'third' },
            { target: Prompts, propertyKey: 'fourth', name: 'fourth' }
        ]);
    });
});
