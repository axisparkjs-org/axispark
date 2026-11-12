import { InjectableMetadata } from '../metadata';
import { Constructable } from './constructable';
import { Metadata, MetadataKeys } from '@axisparkjs/common';

/**
 * A decorator that marks a class as injectable, allowing it to be resolved by the dependency injection container.
 * @returns A class decorator.
 */
export function Injectable(): ClassDecorator {
    return (target) => {
        const metadata: InjectableMetadata = {
            target: Metadata.normalizeTarget(target)
        };

        Constructable(MetadataKeys.INJECTABLE)(target);
        Metadata.define(MetadataKeys.INJECTABLE, metadata, target);
    };
}
