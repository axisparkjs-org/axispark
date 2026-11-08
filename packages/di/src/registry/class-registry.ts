import { Metadata, MetadataKey, ClassType } from '@axisparkjs/common';

/**
 * A static class for managing the registration and retrieval of classes.
 * Classes are stored by identity, so two different classes with the same name are both registered.
 */
export class ClassRegistryStatic {
    private readonly registry = new Set<ClassType>();

    /**
     * Registers a class in the registry. Registering the same class again has no effect.
     * @param constructor The class constructor to register.
     */
    register(constructor: ClassType): void {
        this.registry.add(constructor);
    }

    /**
     * Removes a class from the registry. Other classes with the same name are kept.
     * @param constructor The class constructor to remove.
     */
    remove(constructor: ClassType): void {
        this.registry.delete(constructor);
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
        return this.getAll().filter((cls) => cls.name === name);
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
        const classes = this.getAll();
        return classes.filter((cls) => {
            return Metadata.has(metadata, cls);
        });
    }
}

/**
 * A class registry that can be used to register and retrieve classes. It provides methods for registering, removing, and retrieving classes by identity, name or metadata. Classes are stored by identity, so classes with the same name never replace each other. This registry is useful for managing class dependencies and facilitating dependency injection in applications.
 */
export const ClassRegistry = new ClassRegistryStatic();
