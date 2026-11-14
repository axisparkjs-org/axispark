import { ClassType } from '@axisparkjs/common';
import { InjectableScopes } from '../types';
import { TokenUtils } from '../token';

/**
 * One class of a resolution chain, with the scope it is resolved with.
 */
export interface ResolutionStep {
    classType: ClassType;
    scope: InjectableScopes;
}

/**
 * An instance that is being created, shared by the resolutions that need it at the same time.
 * @template T - The type of the instance.
 */
export interface PendingInstance<T = unknown> {
    /** The class of the instance, used in the error messages. */
    classType: ClassType;
    /** The resolution chain that creates the instance. */
    owner: ResolutionChainState;
    /** The promise that resolves to the instance. */
    promise: Promise<T>;
}

/**
 * The state shared by every step of one resolution chain.
 */
export interface ResolutionChainState {
    /** The pending instance that the chain is waiting for, if any. */
    waitingFor?: PendingInstance;
}

/**
 * The chain of classes that are being resolved by one resolution, from the requested token to the current dependency. Each call to `Container.resolve()` starts a new chain, so concurrent resolutions never see the classes of each other. The chain is used to detect circular dependencies and scope violations.
 */
export class ResolutionChain {
    private constructor(
        /** The chain of the class that depends on the class of this chain, or `undefined` for an empty chain. */
        private readonly parent: ResolutionChain | undefined,
        /** The class of this chain, or `undefined` for an empty chain. */
        private readonly step: ResolutionStep | undefined,
        /** The state shared by every step of the chain. */
        readonly state: ResolutionChainState,
        /** Whether one of the classes of the chain has the singleton scope. */
        private readonly singleton: boolean
    ) {}

    /**
     * Starts a new and empty resolution chain.
     * @returns A new resolution chain.
     */
    static start(): ResolutionChain {
        return new ResolutionChain(undefined, undefined, {}, false);
    }

    /**
     * The classes of the chain, from the first one to the current one. The chain is linked to its parent, so the array is built on each
     * call: it is meant for error messages, not for the resolution hot path.
     */
    get steps(): readonly ResolutionStep[] {
        // A chain with a step always has a parent: the empty chain started by `start()`.
        return this.step ? [...(this.parent as ResolutionChain).steps, this.step] : [];
    }

    /**
     * Creates the chain of a dependency of the current class. The new chain is linked to this one, so no array of steps is copied.
     * @param step The class of the dependency, with its scope.
     * @returns A new chain with the given step at the end, which shares the state of this chain.
     */
    with(step: ResolutionStep): ResolutionChain {
        return new ResolutionChain(this, step, this.state, this.singleton || step.scope === InjectableScopes.Singleton);
    }

    /**
     * Checks whether a class is already being resolved in this chain. It walks the links of the chain without allocating anything.
     * @param classType The class to check.
     * @returns `true` when the class is in the chain.
     */
    includes(classType: ClassType): boolean {
        return this.step !== undefined && (this.step.classType === classType || (this.parent as ResolutionChain).includes(classType));
    }

    /**
     * Checks whether a singleton is being resolved in this chain, in constant time.
     * @returns `true` when one of the classes of the chain has the singleton scope.
     */
    hasSingleton(): boolean {
        return this.singleton;
    }

    /**
     * Describes the classes of the chain, followed by the given classes.
     * @param withScopes Whether to include the scope of each class of the chain.
     * @param next The classes to add at the end of the description.
     * @returns The names of the classes separated by ` -> `.
     */
    describe(withScopes: boolean, ...next: ClassType[]): string {
        const names = this.steps.map((step) => TokenUtils.getName(step.classType) + (withScopes ? ` (${step.scope})` : ''));
        return [...names, ...next.map((classType) => TokenUtils.getName(classType))].join(' -> ');
    }

    /**
     * Finds the cycle that waiting for a pending instance would create: the instance is created by this chain, or by a chain that waits, directly or through other chains, for an instance created by this chain.
     * @param pending The pending instance to wait for.
     * @returns The classes of the pending instances of the cycle, or `undefined` when waiting is safe.
     */
    findWaitCycle(pending: PendingInstance): ClassType[] | undefined {
        const classes: ClassType[] = [];
        const visited = new Set<PendingInstance>();
        let current: PendingInstance | undefined = pending;
        while (current && !visited.has(current)) {
            visited.add(current);
            classes.push(current.classType);
            if (current.owner === this.state) return classes;
            current = current.owner.waitingFor;
        }
        return undefined;
    }

    /**
     * Waits for a pending instance, recording it as the instance this chain is waiting for.
     * @template T - The type of the instance.
     * @param pending The pending instance to wait for.
     * @returns A promise that resolves to the instance.
     */
    async waitFor<T>(pending: PendingInstance<T>): Promise<T> {
        this.state.waitingFor = pending;
        try {
            return await pending.promise;
        } finally {
            this.state.waitingFor = undefined;
        }
    }
}
