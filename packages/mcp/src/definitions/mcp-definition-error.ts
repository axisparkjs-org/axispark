/**
 * An error thrown when the MCP capabilities declared in the application are not valid, for example when two tools have the same name.
 */
export class McpDefinitionError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}
