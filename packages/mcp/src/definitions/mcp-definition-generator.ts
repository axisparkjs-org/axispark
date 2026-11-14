import { ClassType, Generator, Metadata, MetadataKeys } from '@axisparkjs/common';
import { ClassRegistry, Injectable, ScopedContainerManager } from '@axisparkjs/di';
import { ExecutionTransport, ParameterMetadata } from '@axisparkjs/engine';
import { McpEngine } from '../engine';
import { McpPromptArgument, McpPromptMetadata, McpResourceMetadata, McpServerMetadata, McpToolMetadata } from '../metadata';
import { JsonSchema, McpSchemaGenerator } from '../schema';
import { McpContext, McpParameter } from '../types';
import { McpCapabilityDefinition, McpDefinitions } from './mcp-capability-definition';
import { McpDefinitionError } from './mcp-definition-error';
import { McpHandler } from './mcp-handler';
import { McpPromptDefinition } from './mcp-prompt-definition';
import { McpResourceDefinition } from './mcp-resource-definition';
import { McpToolDefinition } from './mcp-tool-definition';

/**
 * A generator for creating the MCP definitions (tools, resources and prompts) of the classes decorated with `@McpServer`.
 */
@Injectable()
export class McpDefinitionGenerator implements Generator<McpDefinitions> {
    constructor(
        private readonly mcpEngine: McpEngine,
        private readonly scopedContainerManager: ScopedContainerManager,
        private readonly schemaGenerator: McpSchemaGenerator
    ) {}

    /**
     * Generates the MCP definitions from the metadata of the scanned classes.
     * @returns The tools, resources and prompts of the application.
     * @throws McpDefinitionError when two tools or prompts share a name, or two resources share a URI.
     */
    async generate(): Promise<McpDefinitions> {
        const definitions: McpDefinitions = { tools: [], resources: [], prompts: [] };

        for (const server of ClassRegistry.getWithMetadata(MetadataKeys.MCP_SERVER)) {
            const serverMetadata = Metadata.get<McpServerMetadata>(MetadataKeys.MCP_SERVER, server) as McpServerMetadata;

            for (const metadata of Metadata.get<McpToolMetadata[]>(MetadataKeys.MCP_TOOL, server) ?? []) {
                definitions.tools.push(this.generateTool(serverMetadata, metadata));
            }
            for (const metadata of Metadata.get<McpResourceMetadata[]>(MetadataKeys.MCP_RESOURCE, server) ?? []) {
                definitions.resources.push(this.generateResource(serverMetadata, metadata));
            }
            for (const metadata of Metadata.get<McpPromptMetadata[]>(MetadataKeys.MCP_PROMPT, server) ?? []) {
                definitions.prompts.push(this.generatePrompt(serverMetadata, metadata));
            }
        }

        this.assertUnique(definitions.tools, (tool) => tool.name, 'tool name');
        this.assertUnique(definitions.resources, (resource) => resource.uri, 'resource URI');
        this.assertUnique(definitions.prompts, (prompt) => prompt.name, 'prompt name');
        return definitions;
    }

    private generateTool(server: McpServerMetadata, metadata: McpToolMetadata): McpToolDefinition {
        const inputSchema = metadata.inputSchema ?? this.generateArgsSchema(metadata.target, metadata.propertyKey);
        const definition: McpToolDefinition = new McpToolDefinition(
            metadata.target,
            metadata.propertyKey,
            this.prefixed(server, metadata.name),
            metadata.description,
            metadata.title,
            inputSchema,
            metadata.annotations,
            this.createHandler(() => definition, metadata)
        );
        return definition;
    }

    private generateResource(server: McpServerMetadata, metadata: McpResourceMetadata): McpResourceDefinition {
        const definition: McpResourceDefinition = new McpResourceDefinition(
            metadata.target,
            metadata.propertyKey,
            metadata.uri,
            this.prefixed(server, metadata.name),
            metadata.description,
            metadata.title,
            metadata.mimeType,
            this.createHandler(() => definition, metadata)
        );
        return definition;
    }

    private generatePrompt(server: McpServerMetadata, metadata: McpPromptMetadata): McpPromptDefinition {
        const promptArguments = metadata.arguments ?? this.generatePromptArguments(this.generateArgsSchema(metadata.target, metadata.propertyKey));
        const definition: McpPromptDefinition = new McpPromptDefinition(
            metadata.target,
            metadata.propertyKey,
            this.prefixed(server, metadata.name),
            metadata.description,
            metadata.title,
            promptArguments,
            this.createHandler(() => definition, metadata)
        );
        return definition;
    }

    /**
     * Generates the JSON Schema of the `@McpArgs()` parameter of a method. Without that parameter, or when its type is not a class, the schema is an open object.
     */
    private generateArgsSchema(target: ClassType, propertyKey: string | symbol): JsonSchema {
        const parameters = Metadata.get<ParameterMetadata[]>(MetadataKeys.PARAMETER, target, propertyKey) ?? [];
        const args = parameters.find((parameter) => parameter.parameter === McpParameter.Args);
        if (!args) return { type: 'object' };

        const types = Metadata.get<unknown[]>(MetadataKeys.DESIGN_PARAM_TYPES, target.prototype, propertyKey, false);
        return this.schemaGenerator.generate(types?.[args.parameterIndex]);
    }

    private generatePromptArguments(schema: JsonSchema): McpPromptArgument[] {
        return Object.entries(schema.properties ?? {}).map(([name, property]) => {
            const argument: McpPromptArgument = { name, required: schema.required?.includes(name) ?? false };
            if (property.description) argument.description = property.description;
            return argument;
        });
    }

    private prefixed(server: McpServerMetadata, name: string): string {
        return server.prefix ? `${server.prefix}.${name}` : name;
    }

    private createHandler(definition: () => McpCapabilityDefinition, metadata: McpToolMetadata | McpResourceMetadata | McpPromptMetadata): McpHandler {
        return async (input) => {
            const context: McpContext = {
                ...input,
                definition: definition(),
                target: metadata.target,
                propertyKey: metadata.propertyKey,
                scopedContainer: this.scopedContainerManager.create(),
                transport: ExecutionTransport.Mcp,
                // The engine replaces it with the signal of the execution, aborted when the client cancels the request.
                signal: input.request.signal ?? new AbortController().signal,
                error: undefined,
                response: undefined
            };
            await this.mcpEngine.execute(context);
            return context.response;
        };
    }

    private assertUnique<T extends McpCapabilityDefinition>(definitions: T[], key: (definition: T) => string, label: string): void {
        const seen = new Map<string, T>();
        for (const definition of definitions) {
            const value = key(definition);
            const previous = seen.get(value);
            if (previous) {
                throw new McpDefinitionError(
                    `Duplicate MCP ${label} '${value}' in ${previous.target.name}.${String(previous.propertyKey)} and ${definition.target.name}.${String(definition.propertyKey)}`
                );
            }
            seen.set(value, definition);
        }
    }
}
