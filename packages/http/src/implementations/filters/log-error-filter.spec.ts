import { LogErrorFilter } from './log-error-filter';
import { Logger } from '@axisparkjs/logger';

describe('LogErrorFilter', () => {
    let logger: jest.Mocked<Logger>;
    let filter: LogErrorFilter;

    beforeEach(() => {
        logger = {
            info: jest.fn()
        } as any;
        (logger as any).nonBlocking = logger;

        filter = new LogErrorFilter(logger);
    });

    it('should log the error', async () => {
        const error = new TypeError('Invalid value');

        await filter.error(error);

        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith('Error during execution: TypeError -> Invalid value');
    });
});
