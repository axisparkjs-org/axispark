import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Constructable } from '@axisparkjs/di';
import { ControllerMetadata } from '../metadata/controller-metadata';

/**
 * A decorator for defining a controller with an optional path prefix and host pattern.
 * @param path The route path or controller options.
 * @returns A class decorator.
 */
export function Controller(path: string | (Omit<ControllerMetadata, 'target' | 'path'> & { path?: string }) = ''): ClassDecorator {
    return (target) => {
        const metadata: ControllerMetadata = {
            target: Metadata.normalizeTarget(target),
            path: typeof path === 'string' ? path : (path.path ?? ''),
            host: typeof path === 'string' ? undefined : path.host,
            version: typeof path === 'string' ? undefined : path.version
        };
        Constructable(MetadataKeys.INJECTABLE)(target);
        Metadata.define(MetadataKeys.CONTROLLER, metadata, target);
    };
}
