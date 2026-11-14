import { LogHttpResponseInterceptor } from './log-http-response-interceptor';
import { Logger } from '@axisparkjs/logger';

describe('LogHttpResponseInterceptor', () => {
    let logger: jest.Mocked<Logger>;
    let interceptor: LogHttpResponseInterceptor;

    beforeEach(() => {
        logger = {
            info: jest.fn()
        } as any;
        (logger as any).nonBlocking = logger;

        interceptor = new LogHttpResponseInterceptor(logger);
    });

    it('should log the HTTP response', async () => {
        const context: any = {
            request: {
                path: '/users'
            },
            response: {
                status: 200
            }
        };

        await interceptor.log(context);

        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith('HTTP Response: 200 /users');
    });
});
