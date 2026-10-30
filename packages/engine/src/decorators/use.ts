import { Metadata, MetadataKeys, ClassType } from '@axisparkjs/common';
import { UseMetadata } from '../metadata';

/**
 * A decorator for defining use steps in classes or methods.
 * @param targets The step classes to use.
 * @returns A use decorator.
 */
export function Use(...targets: ClassType[]): ClassDecorator & MethodDecorator {
    return (target: Function | object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
        const metadata: UseMetadata = {
            target: Metadata.normalizeTarget(target),
            propertyKey,
            targets
        };

        // Method
        if (descriptor) {
            Metadata.define(MetadataKeys.USE, metadata, target, propertyKey as string | symbol);
        }
        // Class
        else {
            Metadata.define(MetadataKeys.USE, metadata, target);
        }
    };
}
