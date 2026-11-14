import { Inject } from '@axisparkjs/di';
import { Context, Interceptor, ExecutionTransport, After } from '@axisparkjs/engine';
import { Logger } from '@axisparkjs/logger';
import { HTTP_LOGGER } from '../../di/tokens';
import { HttpContext } from '../../types';

/**
 * An interceptor for logging HTTP responses.
 */
@Interceptor({ global: true, transport: ExecutionTransport.Http })
export class LogHttpResponseInterceptor {
    constructor(@Inject(HTTP_LOGGER) private readonly logger: Logger) {}

    /**
     * Logs HTTP responses after they are processed.
     * @param context The HTTP context.
     * @returns A promise that resolves when logging is complete.
     */
    @After()
    public async log(@Context() context: HttpContext): Promise<void> {
        this.logger.nonBlocking.info(`HTTP Response: ${context.response.status} ${context.request.path}`);
    }
}
