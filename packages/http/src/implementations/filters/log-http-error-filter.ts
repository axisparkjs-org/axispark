import { Inject } from '@axisparkjs/di';
import { FilteredError, Filter, Catch, ExecutionTransport, StepPriority } from '@axisparkjs/engine';
import { Logger } from '@axisparkjs/logger';
import { HTTP_LOGGER } from '../../di/tokens';
import { HttpError } from '../errors';

/**
 * A global filter for logging HTTP errors during execution.
 */
@Filter({ global: true, transport: ExecutionTransport.Http, priority: StepPriority.Normal })
export class LogHttpErrorFilter {
    constructor(@Inject(HTTP_LOGGER) private readonly logger: Logger) {}

    /**
     * Handles HTTP errors by logging their status and response.
     * @param error The HTTP error to log.
     * @returns A promise that resolves when logging is complete.
     */
    @Catch(HttpError)
    public async httpError(@FilteredError() error: HttpError): Promise<void> {
        this.logger.nonBlocking.info(`HTTP Error: ${error.status} ${error.response}`);
    }
}
