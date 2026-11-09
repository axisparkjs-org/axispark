import { RateLimitDefinition } from '@axisparkjs/engine';
import { WsRateLimitGuard } from './ws-rate-limit-guard';
import { WebSocketRateLimitExceededError } from '../errors';

describe('WsRateLimitGuard', () => {
    const definition = new RateLimitDefinition(1_000, 1);
    const create = (decision: any, rateLimitOptions?: any) => {
        const generator = { generate: jest.fn().mockReturnValue(definition) };
        const processor = { process: jest.fn().mockResolvedValue(decision) };
        return { guard: new WsRateLimitGuard(generator as any, processor as any, { rateLimitOptions } as any), generator, processor };
    };
    const messageContext: any = { connection: { id: 'c1' }, message: { event: 'chat' } };

    it('allows the events within the limit', async () => {
        const { guard, generator, processor } = create({ allowed: true, retryAfterMs: 0 });

        await expect(guard.failedCheckRateLimit(messageContext)).resolves.toBeUndefined();
        expect(generator.generate).toHaveBeenCalledWith(messageContext);
        expect(processor.process).toHaveBeenCalledWith(definition, messageContext);
    });

    it('allows the events without a decision', async () => {
        await expect(create(undefined).guard.failedCheckRateLimit(messageContext)).resolves.toBeUndefined();
    });

    it('does not limit the connection event, which has no message', async () => {
        const { guard, processor } = create({ allowed: false, retryAfterMs: 100 });

        await expect(guard.failedCheckRateLimit({ connection: { id: 'c1' } } as any)).resolves.toBeUndefined();
        expect(processor.process).not.toHaveBeenCalled();
    });

    it('throws a 429 error with the retry time when the limit is exceeded', async () => {
        const promise = create({ allowed: false, retryAfterMs: 750 }).guard.failedCheckRateLimit(messageContext);

        await expect(promise).rejects.toBeInstanceOf(WebSocketRateLimitExceededError);
        await expect(promise).rejects.toMatchObject({ response: 'Too many requests. Please try again later.', status: 429, retryAfterMs: 750 });
    });

    it('uses the configured message', async () => {
        await expect(create({ allowed: false, retryAfterMs: 750 }, { message: 'Slow down' }).guard.failedCheckRateLimit(messageContext)).rejects.toThrow(
            'Slow down'
        );
        await expect(
            create({ allowed: false, retryAfterMs: 750 }, { message: (ms: number) => `Retry in ${ms} ms` }).guard.failedCheckRateLimit(messageContext)
        ).rejects.toThrow('Retry in 750 ms');
    });
});
