import type { RouteConflict, RouteDefinition } from './route-definition';
import { HostDefinition } from '../host/host-definition';
import { VersionDefinition } from '../version/version-definition';

/** Compares two route definitions and reports the conflicts that would affect request dispatching. */
export class RouteComparator {
    /**
     * Reports the conflicts between two routes. Routes only conflict when they use the same HTTP method
     * and can be selected by the same host and version, since those are resolved before the route handler.
     */
    compare(first: RouteDefinition, second: RouteDefinition): RouteConflict[] {
        if (first.httpMethod.toLowerCase() !== second.httpMethod.toLowerCase()) return [];
        if (!HostDefinition.hostsOverlap(first.hosts, second.hosts)) return [];
        if (!VersionDefinition.versionsOverlap(first.versions, second.versions)) return [];

        const firstParts = RouteComparator.pathParts(first.path);
        const secondParts = RouteComparator.pathParts(second.path);
        const firstShape = firstParts.map((part) => RouteComparator.normalizeSegment(part)).join('/');
        const secondShape = secondParts.map((part) => RouteComparator.normalizeSegment(part)).join('/');
        if (firstShape === secondShape) {
            return [{ type: 'duplicate', routes: [first, second], message: 'routes have the same normalized method and path' }];
        }

        const conflicts: RouteConflict[] = [];
        if (
            firstParts.length === secondParts.length &&
            firstParts.some(
                (part, index) =>
                    (RouteComparator.isParameter(part) && RouteComparator.isStatic(secondParts[index])) ||
                    (RouteComparator.isParameter(secondParts[index]) && RouteComparator.isStatic(part))
            ) &&
            RouteComparator.pathsCanOverlap(firstParts, secondParts)
        ) {
            conflicts.push({ type: 'ambiguous', routes: [first, second], message: 'static and dynamic path segments overlap' });
        }

        if (firstParts.some((part) => RouteComparator.isWildcard(part)) && RouteComparator.wildcardCovers(firstParts, secondParts)) {
            conflicts.push({ type: 'unreachable', routes: [first, second], message: 'earlier wildcard route can shadow this route' });
        }
        return conflicts;
    }

    private static pathParts(path: string): string[] {
        const normalized = `/${path}`.replace(/\/+/g, '/').replace(/\/$/, '');
        return normalized === '' ? [] : normalized.slice(1).split('/');
    }

    private static isParameter(segment: string): boolean {
        return segment.startsWith(':');
    }

    private static isWildcard(segment: string): boolean {
        return segment.startsWith('*');
    }

    private static isStatic(segment: string): boolean {
        return !RouteComparator.isParameter(segment) && !RouteComparator.isWildcard(segment);
    }

    private static normalizeSegment(segment: string): string {
        return RouteComparator.isParameter(segment) ? ':' : RouteComparator.isWildcard(segment) ? '*' : segment;
    }

    private static segmentsOverlap(a: string, b: string): boolean {
        return a === b || RouteComparator.isParameter(a) || RouteComparator.isParameter(b) || RouteComparator.isWildcard(a) || RouteComparator.isWildcard(b);
    }

    private static pathsCanOverlap(a: string[], b: string[]): boolean {
        return a.every((segment, index) => RouteComparator.segmentsOverlap(segment, b[index]));
    }

    private static wildcardCovers(earlier: string[], later: string[]): boolean {
        const wildcardIndex = earlier.findIndex((segment) => RouteComparator.isWildcard(segment));
        return (
            wildcardIndex >= 0 &&
            earlier.slice(0, wildcardIndex).every((segment, index) => index < later.length && RouteComparator.segmentsOverlap(segment, later[index]))
        );
    }
}
