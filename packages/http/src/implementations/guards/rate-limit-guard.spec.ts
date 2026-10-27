import { RateLimitDefinition, RateLimitGenerator, RateLimitProcessor } from '@axisparkjs/engine';
import { HttpContext } from '../../types';
import { RateLimitExceededError } from '../errors';
import { RateLimitGuard } from './rate-limit-guard';

describe('RateLimitGuard', () => {
    let generator: jest.Mocked<RateLimitGenerator>;
    let processor: jest.Mocked<RateLimitProcessor>;
    let guard: RateLimitGuard;
    let response: { header: jest.Mock };

    const createContext = (): HttpContext =>
        ({
            request: { ip: '127.0.0.1', method: 'GET', path: '/items' },
            response
        }) as unknown as HttpContext;

    beforeEach(() => {
        generator = { generate: jest.fn() } as unknown as jest.Mocked<RateLimitGenerator>;
        processor = { process: jest.fn() } as unknown as jest.Mocked<RateLimitProcessor>;
        response = { header: jest.fn().mockReturnThis() };
        guard = new RateLimitGuard(generator, processor, { rateLimit: true } as any);
    });

    it('allows execution when there is no definition', async () => {
        generator.generate.mockReturnValue(undefined);
        processor.process.mockResolvedValue(undefined);

        await expect(guard.failedCheckRateLimit(createContext())).resolves.toBeUndefined();
        expect(processor.process).toHaveBeenCalledWith(undefined, expect.anything());
        expect(response.header).not.toHaveBeenCalled();
    });

    it('allows execution when the resolver accepts the request', async () => {
        const definition = new RateLimitDefinition(1_000, 2);
        generator.generate.mockReturnValue(definition);
        processor.process.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
        const context = createContext();

        await expect(guard.failedCheckRateLimit(context)).resolves.toBeUndefined();
        expect(generator.generate).toHaveBeenCalledWith(context);
        expect(processor.process).toHaveBeenCalledWith(definition, context);
        expect(response.header).not.toHaveBeenCalled();
    });

    it('sets Retry-After and throws TooManyRequestsError when the limit is exceeded', async () => {
        generator.generate.mockReturnValue(new RateLimitDefinition(1_000, 1));
        processor.process.mockResolvedValue({ allowed: false, retryAfterMs: 1_500 });

        await expect(guard.failedCheckRateLimit(createContext())).rejects.toEqual(new RateLimitExceededError('Too many requests. Please try again later.'));
        expect(response.header).toHaveBeenCalledWith('Retry-After', '2');
    });

    it('uses the configured message string', async () => {
        processor.process.mockResolvedValue({ allowed: false, retryAfterMs: 500 });
        guard = new RateLimitGuard(generator, processor, { rateLimitOptions: { message: 'Slow down' } } as any);

        await expect(guard.failedCheckRateLimit(createContext())).rejects.toEqual(new RateLimitExceededError('Slow down'));
        expect(response.header).toHaveBeenCalledWith('Retry-After', '1');
    });

    it('uses the configured message callback with retry time', async () => {
        const message = jest.fn((time: number) => `Retry in ${time}ms`);
        processor.process.mockResolvedValue({ allowed: false, retryAfterMs: 750 });
        guard = new RateLimitGuard(generator, processor, { rateLimitOptions: { message } } as any);

        await expect(guard.failedCheckRateLimit(createContext())).rejects.toEqual(new RateLimitExceededError('Retry in 750ms'));
        expect(message).toHaveBeenCalledWith(750);
    });
});
