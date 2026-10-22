import { HttpMethod } from '../types';
import { RouteDefinition } from '../routes/route-definition';
import { HostDefinition } from './host-definition';
import { HostMatcher } from './host-matcher';

describe('HostMatcher', () => {
    class TestController {}

    const handler = jest.fn();
    const route = (hosts: string[]) => new RouteDefinition(TestController, 'index', HttpMethod.Get, '/users', ['*'], hosts, handler);
    const matcher = new HostMatcher();

    const hostDefinition = (host?: string) => {
        const definition = new HostDefinition();
        definition.setHost(host);
        return definition;
    };

    it('selects routes matching a static host', () => {
        const admin = route(['admin.example.com']);
        const api = route(['api.example.com']);

        expect(matcher.match([admin, api], hostDefinition('admin.example.com'))).toEqual([admin]);
    });

    it('selects the most specific matching host route', () => {
        const global = route(['*']);
        const wildcard = route(['*.example.com']);
        const named = route([':tenant.example.com']);
        const staticHost = route(['admin.example.com']);

        expect(matcher.match([global, wildcard, named, staticHost], hostDefinition('admin.example.com'))).toEqual([staticHost]);
    });

    it('uses a global wildcard as a fallback for any hostname', () => {
        const fallback = route(['*']);
        const restricted = route(['admin.example.com']);

        expect(matcher.match([fallback, restricted], hostDefinition('api.example.com'))).toEqual([fallback]);
    });

    it('selects a matching host-specific route over the global wildcard', () => {
        const fallback = route(['*']);
        const restricted = route(['admin.example.com']);

        expect(matcher.match([fallback, restricted], hostDefinition('admin.example.com'))).toEqual([restricted]);
    });

    it('returns the first restricted candidate for guard validation when no host matches', () => {
        const restricted = route(['admin.example.com']);

        expect(matcher.match([restricted], hostDefinition('api.example.com'))).toEqual([restricted]);
    });

    it('treats the global wildcard as a match when the request has no host header', () => {
        const fallback = route(['*']);

        expect(matcher.match([fallback], hostDefinition())).toEqual([fallback]);
    });
});
