import type { StoreKind, StoreTypes } from './store-provider';

/** An operation of a store, such as `consume` of a rate limit store or `get` of a cache store. */
export interface StoreOperation {
    /** The kind of the store. */
    readonly kind: StoreKind;
    /** The name of the method of the store. */
    readonly operation: string;
}

/**
 * Observes the operations of the stores used by the framework, such as `@axisparkjs/telemetry`, which records their duration.
 * Register it with `registerStoreInstrumentation()`.
 */
export interface StoreInstrumentation {
    /**
     * Called before an operation runs.
     * @returns A function called when the operation ends, with its error when it fails.
     */
    start(operation: StoreOperation): (error?: unknown) => void;
}

let current: StoreInstrumentation | undefined;
const instrumented = new WeakSet<object>();

/** Registers the instrumentation of the store operations. Passing undefined removes it. */
export function registerStoreInstrumentation(instrumentation?: StoreInstrumentation): void {
    current = instrumentation;
}

/**
 * Wraps a store so the registered `StoreInstrumentation` observes its operations. The plugins wrap the stores they create, so the
 * instrumentation can be registered before or after them. Without an instrumentation, each operation costs one `undefined` check.
 * @param kind The kind of the store.
 * @param store The store.
 * @returns The wrapped store. A store that is already wrapped is returned as it is.
 */
export function instrumentStore<K extends StoreKind>(kind: K, store: StoreTypes[K]): StoreTypes[K] {
    if (instrumented.has(store as object)) return store;

    const wrapped = new Proxy(store as object, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (typeof value !== 'function' || typeof property !== 'string') return value;

            return function (this: unknown, ...args: unknown[]) {
                const instrumentation = current;
                if (!instrumentation) return value.apply(target, args);

                const end = instrumentation.start({ kind, operation: property });
                try {
                    const result = value.apply(target, args);
                    if (result instanceof Promise) {
                        return result.then(
                            (resolved) => {
                                end();
                                return resolved;
                            },
                            (error: unknown) => {
                                end(error);
                                throw error;
                            }
                        );
                    }
                    end();
                    return result;
                } catch (error) {
                    end(error);
                    throw error;
                }
            };
        }
    });
    instrumented.add(wrapped);
    return wrapped as StoreTypes[K];
}
