import { RouteHandler } from './route-handler';
import { HttpMethod } from '../types';
import { ClassType } from '@axisparkjs/common';
import { RouteComparator } from './route-comparator';

/**
 * A class representing the definition of an HTTP route.
 */
export class RouteDefinition {
    /** The declared routes served by this definition. A grouped dispatch route lists every route it groups; any other route lists itself. */
    public readonly candidates: readonly RouteDefinition[];

    constructor(
        public readonly target: ClassType,
        public readonly propertyKey: string | symbol,
        public readonly httpMethod: HttpMethod,
        public readonly path: string,
        public readonly versions: string[],
        public readonly hosts: string[],
        public readonly handler: RouteHandler,
        candidates?: readonly RouteDefinition[]
    ) {
        this.candidates = candidates ?? [this];
    }

    /** Compares this route with another route and reports any compatibility issues. */
    compare(other: RouteDefinition): RouteConflict[] {
        return new RouteComparator().compare(this, other);
    }
}

export type RouteConflictType = 'duplicate' | 'ambiguous' | 'unreachable';

export interface RouteConflict {
    type: RouteConflictType;
    routes: [RouteDefinition, RouteDefinition];
    message: string;
}
