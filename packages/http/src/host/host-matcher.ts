import { Injectable } from '@axisparkjs/di';
import type { RouteDefinition } from '../routes/route-definition';
import { HostDefinition } from './host-definition';

/** Selects routes whose host patterns match the current HTTP request, with the host patterns compiled when the routes are registered. */
@Injectable()
export class HostMatcher {
    /** Returns the most specific matching host routes, or unrestricted routes as a fallback. */
    match(routes: readonly RouteDefinition[], hostDefinition: HostDefinition): RouteDefinition[] {
        const hostLabels = hostDefinition.hostLabels;
        const matchingRoutes = routes.filter((route) => route.hostPatterns.some((pattern) => pattern.matches(hostLabels)));
        if (matchingRoutes.length === 0) return [routes[0]];

        const highestSpecificity = Math.max(...matchingRoutes.map((route) => route.hostSpecificity));
        return matchingRoutes.filter((route) => route.hostPatterns.some((pattern) => pattern.specificity === highestSpecificity));
    }
}
