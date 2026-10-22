/** A transport-independent rate limit policy. */
export class RateLimitDefinition {
    constructor(
        public readonly ttl: number,
        public readonly limit: number
    ) {}
}
