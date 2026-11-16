import { Metadata, MetadataKey, ClassType } from '@axisparkjs/common';

/**
 * A static class for managing the registration and retrieval of classes.
 * Classes are stored by identity, so two different classes with the same name are both registered.
 *
 * The lookups by metadata and by name are indexed: each one filters the registry the first time and keeps the result until a class is
 * registered or removed, or metadata is defined on a class with `Metadata.define()`.
 */
export class ClassRegistryStatic {
    private readonly registry = new Set<ClassType>();
    private readonly byMetadata = new Map<string | symbol, ClassType[]>();
    private readonly byName = new Map<string, ClassType[]>();
    private indexedVersion?: number;

    /**
     * Registers a class in the registry. Registering the same class again has no effect.
     * @param constructor The class constructor to register.
     */
    register(constructor: ClassType): void {
        if (this.registry.has(constructor)) return;
        this.registry.add(constructor);
        this.invalidate();
    }

    /**
     * Removes a class from the registry. Other classes with the same name are kept.
     * @param constructor The class constructor to remove.
     */
    remove(constructor: ClassType): void {
        if (this.registry.delete(constructor)) this.invalidate();
    }

    /**
     * Checks whether a class is registered.
     * @param constructor The class constructor to check.
     * @returns True if the class is registered, otherwise false.
     */
    has(constructor: ClassType): boolean {
        return this.registry.has(constructor);
    }

    /**
     * Retrieves every registered class with the specified name. Names are not unique: different classes can share a name.
     * @param name The name of the classes to retrieve.
     * @returns An array of the class constructors with that name, in registration order.
     */
    getAllByName(name: string): ClassType[] {
        this.validate();
        if (this.byName.size === 0) {
            for (const cls of this.registry) {
                const classes = this.byName.get(cls.name);
                if (classes) classes.push(cls);
                else this.byName.set(cls.name, [cls]);
            }
        }
        return [...(this.byName.get(name) ?? [])];
    }

    /**
     * Retrieves all registered classes from the registry.
     * @returns An array of all registered class constructors, in registration order.
     */
    getAll(): ClassType[] {
        return Array.from(this.registry);
    }

    /**
     * Retrieves all registered classes that have the specified metadata.
     * @param metadata The metadata to filter by.
     * @returns An array of class constructors that have the specified metadata.
     */
    getWithMetadata(metadata: MetadataKey): ClassType[] {
        this.validate();
        let classes = this.byMetadata.get(metadata.value);
        if (!classes) {
            classes = this.getAll().filter((cls) => Metadata.has(metadata, cls));
            this.byMetadata.set(metadata.value, classes);
        }
        return [...classes];
    }

    /* The indexes are built again after a class is registered or removed, or after metadata is defined on a class. */
    private validate(): void {
        const version = Metadata.version;
        if (typeof version === 'number' && version === this.indexedVersion) return;
        this.invalidate();
        this.indexedVersion = version;
    }

    private invalidate(): void {
        this.byMetadata.clear();
        this.byName.clear();
        this.indexedVersion = undefined;
    }
}

/**
 * A class registry that can be used to register and retrieve classes. It provides methods for registering, removing, and retrieving classes by identity, name or metadata. Classes are stored by identity, so classes with the same name never replace each other. This registry is useful for managing class dependencies and facilitating dependency injection in applications.
 */
export const ClassRegistry = new ClassRegistryStatic();
