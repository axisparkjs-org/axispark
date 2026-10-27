import { RouteDefinition } from './route-definition';
import { HttpMethod } from '../types';
import { RouteHandler } from './route-handler';

describe('RouteDefinition', () => {
    class TestController {
        test() {}
    }

    const handler = jest.fn() as unknown as RouteHandler;
    const route = (path: string, method = HttpMethod.Get, propertyKey: string | symbol = 'test') =>
        new RouteDefinition(TestController, propertyKey, method, path, [], ['*'], handler);

    describe('compare', () => {
        it('finds duplicate paths after normalizing parameters and slashes', () => {
            expect(
                route('/users/:id/')
                    .compare(route('/users/:slug'))
                    .map(({ type }) => type)
            ).toEqual(['duplicate']);
        });

        it('finds overlapping static and dynamic paths', () => {
            expect(
                route('/users/:id')
                    .compare(route('/users/me'))
                    .map(({ type }) => type)
            ).toEqual(['ambiguous']);
            expect(
                route('/users/me')
                    .compare(route('/users/:id'))
                    .map(({ type }) => type)
            ).toEqual(['ambiguous']);
        });

        it('normalizes empty and root paths to the same route', () => {
            expect(
                route('')
                    .compare(route('/'))
                    .map(({ type }) => type)
            ).toEqual(['duplicate']);
        });

        it('finds a specific route shadowed by an earlier wildcard', () => {
            expect(
                route('/users/*')
                    .compare(route('/users/me'))
                    .map(({ type }) => type)
            ).toEqual(['unreachable']);
        });

        it('ignores routes with different methods or unrelated paths', () => {
            expect(route('/users/:id').compare(route('/users/me', HttpMethod.Post))).toEqual([]);
            expect(route('/users/:id').compare(route('/teams/me'))).toEqual([]);
        });
    });

    describe('compare with hosts and versions', () => {
        const scoped = (path: string, versions: string[], hosts: string[]) =>
            new RouteDefinition(TestController, 'test', HttpMethod.Get, path, versions, hosts, handler);

        it('ignores same-path routes with disjoint hosts', () => {
            expect(scoped('/users', [], ['a.example.com']).compare(scoped('/users', [], ['b.example.com']))).toEqual([]);
        });

        it('ignores same-path routes with disjoint versions', () => {
            expect(scoped('/users', ['1'], ['*']).compare(scoped('/users', ['2'], ['*']))).toEqual([]);
        });

        it('reports same-path routes with overlapping hosts and versions', () => {
            expect(
                scoped('/users', ['1', '2'], ['*.example.com'])
                    .compare(scoped('/users', ['2'], ['a.example.com']))
                    .map(({ type }) => type)
            ).toEqual(['duplicate']);
        });
    });

    it('lists itself as its only candidate by default', () => {
        const single = route('/users');

        expect(single.candidates).toEqual([single]);
    });

    it('lists the grouped routes as candidates when provided', () => {
        const first = route('/users');
        const second = route('/users');

        expect(new RouteDefinition(TestController, 'test', HttpMethod.Get, '/users', [], ['*'], handler, [first, second]).candidates).toEqual([first, second]);
    });

    it('stores all route definition values', () => {
        const propertyKey = Symbol('test');
        const routeDefinition = new RouteDefinition(TestController, propertyKey, HttpMethod.Post, '/users', ['1', '2'], ['admin.example.com'], handler);

        expect(routeDefinition.target).toBe(TestController);
        expect(routeDefinition.propertyKey).toBe(propertyKey);
        expect(routeDefinition.httpMethod).toBe(HttpMethod.Post);
        expect(routeDefinition.path).toBe('/users');
        expect(routeDefinition.versions).toEqual(['1', '2']);
        expect(routeDefinition.hosts).toEqual(['admin.example.com']);
        expect(routeDefinition.handler).toBe(handler);
    });

    it('preserves exact handler, target, and path references', () => {
        const target = class AnotherController {};
        const routeHandler = jest.fn() as unknown as RouteHandler;
        const path = '/users/:id';
        const routeDefinition = new RouteDefinition(target, 'test', HttpMethod.Get, path, [], ['*'], routeHandler);

        expect(routeDefinition.target).toBe(target);
        expect(routeDefinition.handler).toBe(routeHandler);
        expect(routeDefinition.path).toBe(path);
    });

    it.each([HttpMethod.Delete, HttpMethod.Get, HttpMethod.Head, HttpMethod.Options, HttpMethod.Patch, HttpMethod.Post, HttpMethod.Put])(
        'stores the %s HTTP method',
        (httpMethod) => {
            expect(route('/users', httpMethod).httpMethod).toBe(httpMethod);
        }
    );
});
