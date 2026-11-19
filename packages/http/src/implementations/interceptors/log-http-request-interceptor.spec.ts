import { LogHttpRequestInterceptor } from './log-http-request-interceptor';
import { Logger } from '@axisparkjs/logger';

describe('LogHttpRequestInterceptor', () => {
    let logger: jest.Mocked<Logger>;
    let interceptor: LogHttpRequestInterceptor;

    beforeEach(() => {
        logger = {
            info: jest.fn()
        } as any;
        (logger as any).nonBlocking = logger;

        interceptor = new LogHttpRequestInterceptor(logger);
    });

    it('should log the HTTP request', async () => {
        const context: any = {
            request: {
                method: 'GET',
                path: '/users'
            }
        };

        await interceptor.log(context);

        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info).toHaveBeenCalledWith('HTTP Request: GET /users');
    });
});
