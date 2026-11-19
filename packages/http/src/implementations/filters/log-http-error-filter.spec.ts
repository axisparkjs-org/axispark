import { LogHttpErrorFilter } from './log-http-error-filter';
import { Logger } from '@axisparkjs/logger';
import { InternalServerError } from '../errors';

describe('LogHttpErrorFilter', () => {
    let logger: jest.Mocked<Logger>;
    let filter: LogHttpErrorFilter;

    beforeEach(() => {
        logger = {
            info: jest.fn()
        } as unknown as jest.Mocked<Logger>;
        (logger as any).nonBlocking = logger;

        filter = new LogHttpErrorFilter(logger);
    });

    it('should log the HTTP error', async () => {
        const error = new InternalServerError('Error occurred');

        await filter.httpError(error);

        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith('HTTP Error: 500 Error occurred');
    });
});
