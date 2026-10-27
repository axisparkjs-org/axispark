import { Inject, Injectable } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';
import { HTTP_LOGGER, HTTP_OPTIONS } from '../di/tokens';
import { HttpPluginOptions, RouteValidationAction } from '../plugin/http-plugin-options';
import { RouteComparator } from './route-comparator';
import { RouteConflict, RouteConflictType, RouteDefinition } from './route-definition';

/** Validates the declared routes and applies the configured action to each conflict found. */
@Injectable()
export class RouteValidator {
    private readonly comparator = new RouteComparator();

    constructor(
        @Inject(HTTP_OPTIONS) private readonly options: HttpPluginOptions,
        @Inject(HTTP_LOGGER) private readonly logger: Logger
    ) {}

    /**
     * Compares every pair of declared routes, expanding grouped dispatch routes into the routes they group.
     * Conflicts configured as 'warn' are logged, and conflicts configured as 'error' are thrown together.
     * @param routes The routes generated for the HTTP plugin.
     */
    async validate(routes: readonly RouteDefinition[]): Promise<void> {
        if (this.options.routeValidation === false) return;

        const actions = this.actions();
        const conflicts = this.findConflicts(routes.flatMap((route) => route.candidates)).filter((conflict) => actions[conflict.type] !== 'ignore');

        for (const conflict of conflicts) {
            if (actions[conflict.type] === 'warn') await this.logger.warn(`HTTP route ${conflict.type}: ${RouteValidator.describeConflict(conflict)}`);
        }

        const errors = conflicts.filter((conflict) => actions[conflict.type] === 'error');
        if (errors.length) {
            const report = errors.map((conflict) => `- ${conflict.type}: ${RouteValidator.describeConflict(conflict)}`).join('\n');
            throw new Error(`HTTP route validation failed with ${errors.length} conflict(s):\n${report}`);
        }
    }

    private findConflicts(routes: readonly RouteDefinition[]): RouteConflict[] {
        const conflicts: RouteConflict[] = [];
        for (let i = 0; i < routes.length; i++) {
            for (let j = i + 1; j < routes.length; j++) {
                conflicts.push(...this.comparator.compare(routes[i], routes[j]));
            }
        }
        return conflicts;
    }

    private actions(): Record<RouteConflictType, RouteValidationAction> {
        const options = this.options.routeValidationOptions;
        return {
            duplicate: options?.onDuplicate ?? 'warn',
            ambiguous: options?.onAmbiguous ?? 'warn',
            unreachable: options?.onUnreachable ?? 'warn'
        };
    }

    private static describeConflict({ message, routes: [first, second] }: RouteConflict): string {
        return `${message}. ${RouteValidator.describeRoute(first)}; ${RouteValidator.describeRoute(second)}`;
    }

    private static describeRoute(route: RouteDefinition): string {
        const hosts = route.hosts.join(', ');
        const versions = route.versions.length > 0 ? `, versions: ${route.versions.join(', ')}` : '';
        return `${route.httpMethod.toUpperCase()} ${route.path} (${route.target.name}.${String(route.propertyKey)}, hosts: ${hosts}${versions})`;
    }
}
