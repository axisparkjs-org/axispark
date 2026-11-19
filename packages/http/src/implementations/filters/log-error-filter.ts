import { Inject } from '@axisparkjs/di';
import { FilteredError as ErrorParam, Filter, Catch, ExecutionTransport, StepPriority } from '@axisparkjs/engine';
import { Logger } from '@axisparkjs/logger';
import { HTTP_LOGGER } from '../../di/tokens';

/**
 * A global filter for logging errors during execution.
 */
@Filter({ global: true, transport: ExecutionTransport.Http, priority: StepPriority.Low })
export class LogErrorFilter {
    constructor(@Inject(HTTP_LOGGER) private readonly logger: Logger) {}

    /**
     * Handles errors by logging their name and message.
     * @param error The error to log.
     * @returns A promise that resolves when logging is complete.
     */
    @Catch(Error)
    public async error(@ErrorParam() error: Error): Promise<void> {
        this.logger.nonBlocking.info(`Error during execution: ${error.name} -> ${error.message}`);
    }
}
