import { Inject } from '@axisparkjs/di';
import { Context, Interceptor, Before, ExecutionTransport } from '@axisparkjs/engine';
import { Logger } from '@axisparkjs/logger';
import { HTTP_LOGGER } from '../../di/tokens';
import { HttpContext } from '../../types';

/**
 * An interceptor for logging HTTP requests.
 */
@Interceptor({ global: true, transport: ExecutionTransport.Http })
export class LogHttpRequestInterceptor {
    constructor(@Inject(HTTP_LOGGER) private readonly logger: Logger) {}

    /**
     * Logs HTTP requests before they are processed.
     * @param context The HTTP context.
     * @returns A promise that resolves when logging is complete.
     */
    @Before()
    public async log(@Context() context: HttpContext): Promise<void> {
        this.logger.nonBlocking.info(`HTTP Request: ${context.request.method} ${context.request.path}`);
    }
}
