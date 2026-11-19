import { ClassType, Generator, Metadata, MetadataKeys } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { ExecutionContext, ExecutionTransport } from '../execution';
import { RateLimitConfiguration, RateLimitMetadata } from '../metadata';
import { RateLimitDefinition } from './rate-limit-definition';

const DEFAULT_TTL = 60_000;
const DEFAULT_LIMIT = 100;

/**
 * Generates rate limit policies from metadata and transport defaults. The policy of each handler and transport is generated once and kept,
 * so the rate limited requests do not read metadata. The kept policies are discarded when the default policy of a transport changes.
 */
@Injectable()
export class RateLimitGenerator implements Generator<RateLimitDefinition | undefined> {
    private static readonly defaults = new Map<ExecutionTransport, RateLimitDefinition>();
    private static defaultsVersion = 0;

    private definitions = new Map<ExecutionTransport, WeakMap<ClassType, Map<PropertyKey, RateLimitDefinition | undefined>>>();
    private definitionsVersion = RateLimitGenerator.defaultsVersion;

    /** Registers the default rate limit policy for one transport. */
    public static registerRateLimit(transport: ExecutionTransport, options?: RateLimitConfiguration): void {
        this.defaultsVersion++;
        if (!options) {
            this.defaults.delete(transport);
            return;
        }

        this.defaults.set(transport, new RateLimitDefinition(options.ttl ?? DEFAULT_TTL, options.limit ?? DEFAULT_LIMIT));
    }

    /** Generates the policy for the current method, class, or transport. */
    public generate(context: ExecutionContext): RateLimitDefinition | undefined {
        if (this.definitionsVersion !== RateLimitGenerator.defaultsVersion) {
            this.definitions = new Map();
            this.definitionsVersion = RateLimitGenerator.defaultsVersion;
        }

        let ofTransport = this.definitions.get(context.transport);
        if (!ofTransport) {
            ofTransport = new WeakMap();
            this.definitions.set(context.transport, ofTransport);
        }
        let ofTarget = ofTransport.get(context.target);
        if (!ofTarget) {
            ofTarget = new Map();
            ofTransport.set(context.target, ofTarget);
        }

        if (ofTarget.has(context.propertyKey)) return ofTarget.get(context.propertyKey);
        const definition = this.build(context);
        ofTarget.set(context.propertyKey, definition);
        return definition;
    }

    private build(context: ExecutionContext): RateLimitDefinition | undefined {
        const classMetadata = Metadata.get<RateLimitMetadata>(MetadataKeys.RATE_LIMIT, context.target);
        const methodMetadata = Metadata.get<RateLimitMetadata>(MetadataKeys.RATE_LIMIT, context.target, context.propertyKey);
        const defaultDefinition = RateLimitGenerator.defaults.get(context.transport);
        const scopeMetadata = methodMetadata ?? classMetadata;

        if (methodMetadata?.disabled) return undefined;
        if (!methodMetadata && classMetadata?.disabled) return undefined;
        if (!scopeMetadata) return defaultDefinition;

        return new RateLimitDefinition(
            scopeMetadata.options?.ttl ?? defaultDefinition?.ttl ?? DEFAULT_TTL,
            scopeMetadata.options?.limit ?? defaultDefinition?.limit ?? DEFAULT_LIMIT
        );
    }
}
