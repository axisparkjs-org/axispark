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
 * The state shared by every step of one resolution chain. The dependencies of a constructor are resolved in parallel, each one in a fork
 * of the chain with its own state, linked to the state of the chain that forks it.
 */
export interface ResolutionChainState {
    /** The state of the chain that forked this one, if any. */
    readonly parent?: ResolutionChainState;
    /** The states of the forks of this chain. */
    readonly forks: Set<ResolutionChainState>;
    /** The pending instances that the chain is waiting for. */
    readonly waitingFor: Set<PendingInstance>;
}

/**
 * The chain of classes that are being resolved by one resolution, from the requested token to the current dependency. Each call to `Container.resolve()` starts a new chain, so concurrent resolutions never see the classes of each other. The chain is used to detect circular dependencies and scope violations.
 */
export class ResolutionChain {
    private constructor(
        /** The classes of the chain, from the first one to the current one. */
        readonly steps: readonly ResolutionStep[],
        /** The state shared by every step of the chain. */
        readonly state: ResolutionChainState
    ) {}

    /**
     * Starts a new and empty resolution chain.
     * @returns A new resolution chain.
     */
    static start(): ResolutionChain {
        return new ResolutionChain([], { forks: new Set(), waitingFor: new Set() });
    }

    /**
     * Creates the chain of a dependency of the current class.
     * @param step The class of the dependency, with its scope.
     * @returns A new chain with the given step at the end, which shares the state of this chain.
     */
    with(step: ResolutionStep): ResolutionChain {
        return new ResolutionChain([...this.steps, step], this.state);
    }

    /**
     * Creates a fork of the chain, with the same classes and its own state, to resolve one of several dependencies in parallel. The forks
     * of a chain can wait for the instances created by each other, and a wait for an instance created by the chain or by one of its
     * ancestors is still detected as a cycle.
     * @returns A new chain with the same steps and a new state linked to the state of this chain.
     */
    fork(): ResolutionChain {
        const state: ResolutionChainState = { parent: this.state, forks: new Set(), waitingFor: new Set() };
        this.state.forks.add(state);
        return new ResolutionChain(this.steps, state);
    }

    /**
     * Checks whether a class is already being resolved in this chain.
     * @param classType The class to check.
     * @returns `true` when the class is in the chain.
     */
    includes(classType: ClassType): boolean {
        return this.steps.some((step) => step.classType === classType);
    }

    /**
     * Checks whether a singleton is being resolved in this chain.
     * @returns `true` when one of the classes of the chain has the singleton scope.
     */
    hasSingleton(): boolean {
        return this.steps.some((step) => step.scope === InjectableScopes.Singleton);
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
     * Finds the cycle that waiting for a pending instance would create: the instance is created by this chain or one of its ancestors, or by
     * a chain that waits, directly, through its forks or through other chains, for an instance created by one of them.
     * @param pending The pending instance to wait for.
     * @returns The classes of the pending instances of the cycle, or `undefined` when waiting is safe.
     */
    findWaitCycle(pending: PendingInstance): ClassType[] | undefined {
        const ancestors = new Set<ResolutionChainState>();
        for (let state: ResolutionChainState | undefined = this.state; state; state = state.parent) ancestors.add(state);

        const visited = new Set<PendingInstance>();
        const visit = (current: PendingInstance, path: ClassType[]): ClassType[] | undefined => {
            if (visited.has(current)) return undefined;
            visited.add(current);

            const classes = [...path, current.classType];
            if (ancestors.has(current.owner)) return classes;
            for (const waited of ResolutionChain.waitsOf(current.owner)) {
                const cycle = visit(waited, classes);
                if (cycle) return cycle;
            }
            return undefined;
        };
        return visit(pending, []);
    }

    /* The pending instances that a chain waits for, directly or through its forks. */
    private static *waitsOf(state: ResolutionChainState): Generator<PendingInstance> {
        yield* state.waitingFor;
        for (const fork of state.forks) yield* this.waitsOf(fork);
    }

    /**
     * Waits for a pending instance, recording it as one of the instances this chain is waiting for.
     * @template T - The type of the instance.
     * @param pending The pending instance to wait for.
     * @returns A promise that resolves to the instance.
     */
    async waitFor<T>(pending: PendingInstance<T>): Promise<T> {
        this.state.waitingFor.add(pending);
        try {
            return await pending.promise;
        } finally {
            this.state.waitingFor.delete(pending);
        }
    }
}
