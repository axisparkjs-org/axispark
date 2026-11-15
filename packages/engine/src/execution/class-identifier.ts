import { ClassType } from '@axisparkjs/common';
import { ClassRegistry } from '@axisparkjs/di';

/**
 * Gives each class a unique and stable identifier for the keys kept in the stores, such as the cached results and the rate limit buckets.
 * `target.name` is not unique: two classes of different files can share it, and then they would share their entries.
 *
 * The identifier is the name of the class, so the keys stay readable and do not change for the applications without repeated names.
 * When several classes registered in the `ClassRegistry` share a name, the first one keeps the name and the others get `<name>#<n>`, by
 * registration order. The registration order is the import order of the files, so every process of the same application gives the same
 * identifiers, and shared stores (such as Redis) keep working between replicas. A class that is not registered gets `<name>~<n>`, unique in
 * the process.
 */
export class ClassIdentifierStatic {
    private readonly ids = new WeakMap<ClassType, string>();
    private readonly unregistered = new Map<string, number>();

    /**
     * Returns the identifier of a class. The same class always gets the same identifier.
     * @param target The class to identify.
     */
    public of(target: ClassType): string {
        let id = this.ids.get(target);
        if (id !== undefined) return id;

        const name = target.name;
        const index = ClassRegistry.getAllByName(name).indexOf(target);
        if (index >= 0) {
            id = index === 0 ? name : `${name}#${index + 1}`;
        } else {
            const count = (this.unregistered.get(name) ?? 0) + 1;
            this.unregistered.set(name, count);
            id = count === 1 && !ClassRegistry.getAllByName(name).length ? name : `${name}~${count}`;
        }

        this.ids.set(target, id);
        return id;
    }
}

/**
 * The `ClassIdentifierStatic` instance used by the engine to build the keys of the cached results and the rate limit buckets.
 */
export const ClassIdentifier = new ClassIdentifierStatic();
