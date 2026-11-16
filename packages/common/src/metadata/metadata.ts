import 'reflect-metadata';
import { MetadataKey } from './metadata-key';
import { ClassType } from '../types';

/**
 * Static class for managing metadata using the Reflect Metadata API. It provides methods to define, get, and check metadata on classes, methods, properties, and parameters. The class uses the Reflect Metadata API to store and retrieve metadata associated with specified keys and values.
 */
export class MetadataStatic {
    private classChanges = 0;

    /**
     * A counter that changes every time metadata is defined on a class (without property key). Indexes of classes by metadata, such as the
     * one of the `ClassRegistry`, compare it to know when they must be built again.
     */
    get version(): number {
        return this.classChanges;
    }

    /**
     * Defines metadata for a target object or its property. It uses the Reflect Metadata API to store the metadata associated with the specified key and value. The method can be used to define metadata on classes, methods, properties, and parameters.
     * @param key - The metadata key used to identify the metadata.
     * @param value - The metadata value to be associated with the target.
     * @param target - The target object on which the metadata is defined.
     * @param propertyKey - An optional property key for defining metadata on a specific property or method of the target.
     * @param normalizeTarget - A boolean indicating whether to normalize the target to its constructor (default: true). If true, the target will be normalized to its constructor before defining the metadata. If false, the metadata will be defined directly on the provided target object.
     */
    define(key: MetadataKey, value: unknown, target: object, propertyKey?: string | symbol, normalizeTarget = true): void {
        if (propertyKey) Reflect.defineMetadata(key.value, value, normalizeTarget ? this.normalizeTarget(target) : target, propertyKey);
        else {
            Reflect.defineMetadata(key.value, value, normalizeTarget ? this.normalizeTarget(target) : target);
            this.classChanges++;
        }
    }
    /**
     * Retrieves metadata for a target object or its property. It uses the Reflect Metadata API to get the metadata associated with the specified key. The method can be used to retrieve metadata from classes, methods, properties, and parameters.
     * @param key - The metadata key used to identify the metadata.
     * @param target - The target object from which the metadata is retrieved.
     * @param propertyKey - An optional property key for retrieving metadata from a specific property or method of the target.
     * @param normalizeTarget - A boolean indicating whether to normalize the target to its constructor (default: true). If true, the target will be normalized to its constructor before retrieving the metadata. If false, the metadata will be retrieved directly from the provided target object.
     * @returns The metadata value associated with the specified key, or `undefined` if no metadata is found.
     */
    get<T>(key: MetadataKey, target: object, propertyKey?: string | symbol, normalizeTarget = true): T | undefined {
        if (propertyKey) return Reflect.getMetadata(key.value, normalizeTarget ? this.normalizeTarget(target) : target, propertyKey);
        return Reflect.getMetadata(key.value, normalizeTarget ? this.normalizeTarget(target) : target);
    }
    /**
     * Checks if metadata exists for a target object or its property. It uses the Reflect Metadata API to check the existence of metadata associated with the specified key. The method can be used to check metadata from classes, methods, properties, and parameters.
     * @param key - The metadata key used to identify the metadata.
     * @param target - The target object for which the metadata is checked.
     * @param propertyKey - An optional property key for checking metadata on a specific property or method of the target.
     * @param normalizeTarget - A boolean indicating whether to normalize the target to its constructor (default: true). If true, the target will be normalized to its constructor before checking the metadata. If false, the metadata will be checked directly on the provided target object.
     * @returns A boolean indicating whether the metadata exists.
     */
    has(key: MetadataKey, target: object, propertyKey?: string | symbol, normalizeTarget = true): boolean {
        if (propertyKey) return Reflect.hasMetadata(key.value, normalizeTarget ? this.normalizeTarget(target) : target, propertyKey);
        return Reflect.hasMetadata(key.value, normalizeTarget ? this.normalizeTarget(target) : target);
    }
    /**
     * Normalizes the target to its constructor.
     * @param target - The target object to normalize.
     * @returns The normalized target object.
     */
    normalizeTarget(target: object): ClassType {
        return (typeof target === 'function' ? target : target.constructor) as ClassType;
    }
}

/**
 * A Metadata utility class that provides methods to define, get, and check metadata on classes, methods, properties, and parameters. It uses the Reflect Metadata API to store and retrieve metadata.
 */
export const Metadata = new MetadataStatic();
