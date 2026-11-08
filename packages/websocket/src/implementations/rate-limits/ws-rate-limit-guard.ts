import { Inject } from '@axisparkjs/di';
import { Check, Context, ExecutionTransport, Guard, RateLimitGenerator, RateLimitProcessor, StepPriority } from '@axisparkjs/engine';
import { WEBSOCKET_OPTIONS } from '../../di/tokens';
import { WebSocketPluginOptions } from '../../plugin/websocket-plugin-options';
import { WebSocketContext } from '../../types';
import { WebSocketRateLimitExceededError } from '../errors';

/**
 * Applies the rate limits of the WebSocket events and raises a `WebSocketRateLimitExceededError` when a client exceeds them, so the handler
 * is not invoked. It only limits the messages: the `connection` event has no message and is not limited.
 */
@Guard({ transport: ExecutionTransport.WebSocket, priority: StepPriority.Critical })
export class WsRateLimitGuard {
    constructor(
        private readonly rateLimitGenerator: RateLimitGenerator,
        private readonly rateLimitProcessor: RateLimitProcessor,
        @Inject(WEBSOCKET_OPTIONS) private readonly options: WebSocketPluginOptions
    ) {}

    @Check()
    public async failedCheckRateLimit(@Context() context: WebSocketContext): Promise<void> {
        if (!context.message) return;

        const definition = this.rateLimitGenerator.generate(context);
        const decision = await this.rateLimitProcessor.process(definition, context);
        if (!decision || decision.allowed) return;

        throw new WebSocketRateLimitExceededError(decision.retryAfterMs, this.getMessage(decision.retryAfterMs));
    }

    private getMessage(retryAfterMs: number): string {
        const message = this.options.rateLimitOptions?.message;
        if (typeof message === 'function') return message(retryAfterMs);
        return message ?? 'Too many requests. Please try again later.';
    }
}
