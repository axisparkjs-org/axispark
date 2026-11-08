import { ExecutionContext, ExecutionTransport } from '../execution';
import { TimeoutDefinition } from './timeout-definition';
import { TimeoutProcessor } from './timeout-processor';
import { TimeoutResolver } from './timeout-resolver';
import { ExecutionTimeoutError } from './timeout-errors';

describe('TimeoutProcessor', () => {
    let processor: TimeoutProcessor;

    beforeEach(() => {
        processor = new TimeoutProcessor();
    });

    describe('registerTimeout', () => {
        it('should register the resolver for the given transport', async () => {
            const resolver: TimeoutResolver = {
                resolve: jest.fn().mockResolvedValue(undefined)
            };

            TimeoutProcessor.registerTimeout(ExecutionTransport.Http, resolver);

            const timeout = new TimeoutDefinition(5000);
            const context = {
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            await processor.process(timeout, context);

            expect(resolver.resolve).toHaveBeenCalledTimes(1);
            expect(resolver.resolve).toHaveBeenCalledWith(timeout);
        });
    });

    describe('process', () => {
        it('should call the resolver with the timeout', async () => {
            const resolver: TimeoutResolver = {
                resolve: jest.fn().mockResolvedValue(undefined)
            };

            TimeoutProcessor.registerTimeout(ExecutionTransport.Http, resolver);

            const timeout = new TimeoutDefinition(3000);
            const context = {
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            await processor.process(timeout, context);

            expect(resolver.resolve).toHaveBeenCalledWith(timeout);
        });

        it('should preserve the timeout value', async () => {
            const resolver: TimeoutResolver = {
                resolve: jest.fn().mockResolvedValue(undefined)
            };

            TimeoutProcessor.registerTimeout(ExecutionTransport.Http, resolver);

            const timeout = new TimeoutDefinition(3000);
            const context = {
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            await processor.process(timeout, context);

            const receivedTimeout = (resolver.resolve as jest.Mock).mock.calls[0][0] as TimeoutDefinition;

            expect(receivedTimeout).toBe(timeout);
            expect(receivedTimeout.time).toBe(3000);
        });

        it('should throw an ExecutionTimeoutError when no resolver is registered', async () => {
            const timeout = new TimeoutDefinition(3000);
            const context = {
                transport: 'test' as ExecutionTransport
            } as ExecutionContext;

            const promise = processor.process(timeout, context);

            await expect(promise).rejects.toBeInstanceOf(ExecutionTimeoutError);
            await expect(promise).rejects.toThrow('Execution timed out after 3000ms');
            await expect(promise).rejects.toMatchObject({ name: 'ExecutionTimeoutError', time: 3000, transport: 'test' });
        });

        it('should propagate resolver errors', async () => {
            const error = new Error('Resolver error');

            const resolver: TimeoutResolver = {
                resolve: jest.fn().mockRejectedValue(error)
            };

            TimeoutProcessor.registerTimeout(ExecutionTransport.Http, resolver);

            const timeout = new TimeoutDefinition(3000);
            const context = {
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            await expect(processor.process(timeout, context)).rejects.toThrow(error);
        });

        it('should use the resolver associated with the context transport', async () => {
            const httpResolver: TimeoutResolver = {
                resolve: jest.fn().mockResolvedValue(undefined)
            };

            const otherResolver: TimeoutResolver = {
                resolve: jest.fn().mockResolvedValue(undefined)
            };

            TimeoutProcessor.registerTimeout(ExecutionTransport.Http, httpResolver);

            TimeoutProcessor.registerTimeout(ExecutionTransport.All, otherResolver);

            const timeout = new TimeoutDefinition(3000);
            const context = {
                transport: ExecutionTransport.Http
            } as ExecutionContext;

            await processor.process(timeout, context);

            expect(httpResolver.resolve).toHaveBeenCalledWith(timeout);
            expect(otherResolver.resolve).not.toHaveBeenCalled();
        });
    });
});
