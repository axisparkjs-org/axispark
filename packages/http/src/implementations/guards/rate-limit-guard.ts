import { Inject } from '@axisparkjs/di';
import { Check, Context, ExecutionTransport, Guard, RateLimitGenerator, RateLimitProcessor, StepPriority } from '@axisparkjs/engine';
import { HTTP_OPTIONS } from '../../di';
import { HttpContext } from '../../types';
import { HttpPluginOptions } from '../../plugin/http-plugin-options';
import { RateLimitExceededError } from '../errors';

/** Applies the HTTP rate limit and raises the standard HTTP error when it is exceeded. */
@Guard({ transport: ExecutionTransport.Http, priority: StepPriority.Critical })
export class RateLimitGuard {
    constructor(
        private readonly rateLimitGenerator: RateLimitGenerator,
        private readonly rateLimitProcessor: RateLimitProcessor,
        @Inject(HTTP_OPTIONS) private readonly options: HttpPluginOptions
    ) {}

    @Check()
    public async failedCheckRateLimit(@Context() context: HttpContext): Promise<void> {
        const definition = this.rateLimitGenerator.generate(context);
        const decision = await this.rateLimitProcessor.process(definition, context);
        if (!decision || decision.allowed) return;

        context.response.header('Retry-After', String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))));
        throw new RateLimitExceededError(this.getMessage(decision.retryAfterMs));
    }

    private getMessage(retryAfterMs: number): string {
        const message = this.options.rateLimitOptions?.message;
        if (typeof message === 'function') return message(retryAfterMs);
        return message ?? 'Too many requests. Please try again later.';
    }
}
