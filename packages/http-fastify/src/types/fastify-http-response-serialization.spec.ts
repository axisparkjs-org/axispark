import fastify from 'fastify';
import { FastifyHttpResponse } from './fastify-http-response';

describe('FastifyHttpResponse serialization with a real Fastify instance', () => {
    const schemas = {
        200: {
            $ref: '#/components/schemas/Product',
            components: {
                schemas: {
                    Product: {
                        type: 'object',
                        properties: { id: { type: 'number', example: 1 }, tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } } }
                    },
                    Tag: { type: 'object', properties: { label: { type: 'string' } } }
                }
            }
        }
    };

    it('should serialize with the schema, resolve the references of the components and keep JSON for other bodies', async () => {
        const app = fastify();
        app.get('/product', async (_request, reply) => {
            new FastifyHttpResponse(reply, schemas).json({ id: 1, internal: true, tags: [{ label: 'new', extra: 1 }] });
            return reply;
        });
        app.get('/null', async (_request, reply) => {
            new FastifyHttpResponse(reply, schemas).json(null);
            return reply;
        });

        const product = await app.inject('/product');
        const empty = await app.inject('/null');
        await app.close();

        expect(product.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(product.body).toBe('{"id":1,"tags":[{"label":"new"}]}');
        expect(empty.body).toBe('null');
    });
});
