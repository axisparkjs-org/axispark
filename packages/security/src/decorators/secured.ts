import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { SecuredMetadata } from '../metadata/secured-metadata';

/**
 * Marks a controller class or handler method as protected by authentication and
 * authorization.
 *
 * Class policies apply to every handler in the class. Method policies apply to
 * that handler only. When both are present, the authorization engine evaluates
 * both sets and requires every decision to allow the request.
 *
 * A secured handler with an empty policy list still requires authentication.
 *
 * @param data Security metadata to attach. The `policies` property lists
 * authorization policy classes to resolve from the dependency injection
 * container.
 * @returns A decorator usable on a class or a method.
 *
 * @example
 * ```ts
 * @Controller('/reports')
 * @Secured({ policies: [SignedInPolicy] })
 * class ReportsController {
 *   @Get('/:id')
 *   @Secured({ policies: [ReportOwnerPolicy] })
 *   getReport() {}
 * }
 * ```
 */
export function Secured(data: Pick<SecuredMetadata, 'policies'>): ClassDecorator & MethodDecorator {
    return (target: Function | object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
        const metadata: SecuredMetadata = {
            target: Metadata.normalizeTarget(target),
            propertyKey,
            ...data
        };

        // Method
        if (descriptor) {
            Metadata.define(MetadataKeys.SECURED, metadata, target, propertyKey as string | symbol);
        }
        // Class
        else {
            Metadata.define(MetadataKeys.SECURED, metadata, target);
        }
    };
}
