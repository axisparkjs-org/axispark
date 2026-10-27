import { Injectable } from '@axisparkjs/di';
import type { RouteDefinition } from '../routes/route-definition';
import { HostDefinition } from './host-definition';

/** Selects routes whose host patterns match the current HTTP request. */
@Injectable()
export class HostMatcher {
    /** Returns the most specific matching host routes, or unrestricted routes as a fallback. */
    match(routes: readonly RouteDefinition[], hostDefinition: HostDefinition): RouteDefinition[] {
        const matchingRoutes = routes.filter((route) => HostDefinition.isHostAccepted(hostDefinition.host, route.hosts));
        if (matchingRoutes.length === 0) return [routes[0]];

        const highestSpecificity = Math.max(...matchingRoutes.map((route) => Math.max(...route.hosts.map((host) => HostDefinition.specificity(host)))));
        return matchingRoutes.filter((route) => route.hosts.some((host) => HostDefinition.specificity(host) === highestSpecificity));
    }
}
