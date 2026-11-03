import { McpResourceDefinition } from './mcp-resource-definition';

describe('McpResourceDefinition', () => {
    const create = (uri: string) => new McpResourceDefinition(class {}, 'read', uri, 'name', undefined, undefined, undefined, jest.fn());

    it('should match a fixed URI exactly', () => {
        const definition = create('config://app');

        expect(definition.isTemplate).toBe(false);
        expect(definition.match('config://app')).toEqual({});
        expect(definition.match('config://other')).toBeUndefined();
    });

    it('should extract the variables of a URI template', () => {
        const definition = create('users://{id}/posts/{post}');

        expect(definition.isTemplate).toBe(true);
        expect(definition.match('users://1/posts/2')).toEqual({ id: '1', post: '2' });
        expect(definition.match('orders://1')).toBeUndefined();
    });
});
