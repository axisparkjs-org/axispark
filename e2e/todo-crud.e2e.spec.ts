import { AxiSparkTestFactory } from '@axisparkjs/test';
import { AxiSparkCore } from '@axisparkjs/core';
import { HttpPlugin } from '@axisparkjs/http';
import { app as appExpress } from '@axisparkjs/samples/todo-crud/src/app-express';
import { app as appFasitfy } from '@axisparkjs/samples/todo-crud/src/app-fastify';
import { ExpressHttpAdapter } from '@axisparkjs/http-express';
import { FastifyHttpAdapter } from '@axisparkjs/http-fastify';

describe.each([
    { name: 'Express', app: appExpress },
    { name: 'Fastify', app: appFasitfy }
])('TODO Crud App ($name)', ({ app, name }) => {
    let axiSparkCore: AxiSparkCore;

    beforeAll(async () => {
        axiSparkCore = AxiSparkTestFactory.create({
            app
        });
        await axiSparkCore.init();
        await axiSparkCore.run();
    });

    it('should create an instance of AxiSparkTestCore', () => {
        expect(axiSparkCore).toBeInstanceOf(AxiSparkCore);
    });

    it('should create the app with TODO Crud plugin', async () => {
        const plugins = axiSparkCore.used();
        expect(plugins).toHaveLength(1);
        expect(plugins).toStrictEqual([
            {
                type: HttpPlugin,
                options: expect.objectContaining({
                    basePath: '/api',
                    adapter: name === 'Express' ? ExpressHttpAdapter : FastifyHttpAdapter,
                    plugin: HttpPlugin,
                    port: 3000
                })
            }
        ]);
    });

    it('should handle GET requests to /todos', async () => {
        const response = await fetch('http://localhost:3000/api/todos', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([]);
    });

    it('should handle GET requests to /todos/:index when the index is not found', async () => {
        const response = await fetch('http://localhost:3000/api/todos/999', {
            method: 'GET'
        });
        expect(response.status).toBe(404);
    });

    it('should return a Bad Request when the index is not a valid integer', async () => {
        const response = await fetch('http://localhost:3000/api/todos/abc', {
            method: 'GET'
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            status: 400,
            error: "Parsing failed for 'path' as integer: Value 'abc' is not a valid integer.",
            cause: 'PipeStepParsingError'
        });
    });

    it('should handle POST requests to /todos', async () => {
        const newTodo = { task: 'Test Todo' };
        const response = await fetch('http://localhost:3000/api/todos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newTodo)
        });
        expect(response.status).toBe(201);
        const createdTodo = await response.json();
        expect(createdTodo).toMatchObject(newTodo);
    });

    it('should handle PUT requests to /todos/:index', async () => {
        const updatedTodo = { task: 'Updated Test Todo' };
        const response = await fetch('http://localhost:3000/api/todos/0', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedTodo)
        });
        expect(response.status).toBe(200);
        const updatedTodoResponse = await response.json();
        expect(updatedTodoResponse).toMatchObject(updatedTodo);
    });

    it('should handle GET requests to /todos/:index when the index is found', async () => {
        const response = await fetch('http://localhost:3000/api/todos/0', {
            method: 'GET'
        });
        expect(response.status).toBe(200);
        const todo = await response.json();
        expect(todo).toMatchObject({ index: 0, task: 'Updated Test Todo' });
    });

    it('should handle DELETE requests to /todos/:index', async () => {
        const response = await fetch('http://localhost:3000/api/todos/0', {
            method: 'DELETE'
        });
        expect(response.status).toBe(204);
    });

    afterAll(async () => {
        await axiSparkCore.destroy();
    });
});
