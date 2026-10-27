import { HttpMethod } from '../types';
import { RouteDefinition } from '../routes/route-definition';
import { VersionDefinition } from './version-definition';
import { VersionMatcher } from './version-matcher';

describe('VersionMatcher', () => {
    class TestController {}

    const handler = jest.fn();
    const route = (versions: string[]) => new RouteDefinition(TestController, 'index', HttpMethod.Get, '/users', versions, ['*'], handler);
    const matcher = new VersionMatcher();

    const versionDefinition = (version?: string) => {
        const definition = new VersionDefinition();
        definition.setVersion(version);
        return definition;
    };

    it('selects the exact requested version', () => {
        const versionOne = route(['1']);
        const versionTwo = route(['2']);

        expect(matcher.match([versionOne, versionTwo], versionDefinition('2'))).toBe(versionTwo);
    });

    it('prefers an exact version over an earlier wildcard route', () => {
        const fallback = route(['*']);
        const versionTwo = route(['2']);

        expect(matcher.match([fallback, versionTwo], versionDefinition('2'))).toBe(versionTwo);
    });

    it('uses a wildcard route when no exact version is available', () => {
        const versionOne = route(['1']);
        const fallback = route(['*']);

        expect(matcher.match([versionOne, fallback], versionDefinition('3'))).toBe(fallback);
    });

    it('uses a wildcard route when the request has no version', () => {
        const versionOne = route(['1']);
        const fallback = route(['*']);

        expect(matcher.match([versionOne, fallback], versionDefinition())).toBe(fallback);
    });

    it('supports the documented default marker as a wildcard fallback', () => {
        const fallback = route(['default']);

        expect(matcher.match([fallback], versionDefinition('3'))).toBe(fallback);
    });

    it('falls back to the first route when no wildcard or exact route exists', () => {
        const versionOne = route(['1']);
        const versionTwo = route(['2']);

        expect(matcher.match([versionOne, versionTwo], versionDefinition('3'))).toBe(versionOne);
    });

    it('returns undefined when there are no routes', () => {
        expect(matcher.match([], versionDefinition())).toBeUndefined();
    });
});
