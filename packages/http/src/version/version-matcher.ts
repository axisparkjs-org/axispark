import { Injectable } from '@axisparkjs/di';
import type { RouteDefinition } from '../routes/route-definition';
import { VersionDefinition } from './version-definition';

/** Selects the route that matches the version requested by an HTTP request. */
@Injectable()
export class VersionMatcher {
    /** Returns an exact requested-version route before the wildcard default, then the first route. */
    match(routes: readonly RouteDefinition[], versionDefinition: VersionDefinition): RouteDefinition {
        return (
            (versionDefinition.version === undefined || VersionDefinition.isWildcard(versionDefinition.version)
                ? undefined
                : routes.find((route) => route.versions.includes(versionDefinition.version as string))) ??
            routes.find((route) => route.versions.some((version) => VersionDefinition.isWildcard(version))) ??
            routes[0]
        );
    }
}
