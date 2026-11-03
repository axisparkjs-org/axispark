import { ClassRegistry } from '@axisparkjs/di';
import { HealthEngine } from './health-engine';
import { HealthStatus } from './health-status';
import { HealthCheck } from './health-check';
import { HealthIndicator } from './health-indicator';
import { HealthCheckResult } from './health-check-result';
import { PluginLifecycle } from '../plugin/plugin';

describe('HealthEngine', () => {
    const createPlugin = (name: string, state?: PluginLifecycle, error?: Error) => ({
        type: { name },
        instance: {
            getState: jest.fn().mockReturnValue(state),
            getStateError: jest.fn().mockReturnValue(error)
        }
    });

    const createIndicator = (check: () => Promise<HealthCheckResult>): HealthIndicator => ({ check: jest.fn(check) });

    const createEngine = (plugins: any[], container: any = { resolve: jest.fn() }) => {
        const config = {
            name: 'AxisApp',
            version: '1.0.0'
        };

        const registry = {
            getAll: jest.fn().mockReturnValue(plugins)
        };

        return {
            engine: new HealthEngine(config as any, registry as any, container),
            registry,
            container
        };
    };

    describe('checkAll', () => {
        it('should return only app health when there are no plugins', async () => {
            const { engine } = createEngine([]);

            const result = await engine.checkAll();

            expect(result).toHaveLength(1);

            expect(result[0]).toEqual(
                expect.objectContaining({
                    component: 'AxisApp',
                    status: HealthStatus.Healthy,
                    details: expect.objectContaining({
                        plugins: [],
                        checks: []
                    }),
                    timestamp: expect.any(String)
                })
            );
        });

        it('should return healthy when all plugins are healthy', async () => {
            const { engine } = createEngine([createPlugin('PluginA', PluginLifecycle.Started), createPlugin('PluginB', PluginLifecycle.Started)]);

            const result = await engine.checkAll();

            expect(result[0].status).toBe(HealthStatus.Healthy);

            expect(result[1].status).toBe(HealthStatus.Healthy);
            expect(result[2].status).toBe(HealthStatus.Healthy);
        });

        it('should return unhealthy when any plugin is unhealthy', async () => {
            const { engine } = createEngine([createPlugin('PluginA', PluginLifecycle.Started), createPlugin('PluginB', PluginLifecycle.Error)]);

            const result = await engine.checkAll();

            expect(result[0].status).toBe(HealthStatus.Unhealthy);
            expect(result[2].status).toBe(HealthStatus.Unhealthy);
        });

        it('should include plugin error', async () => {
            const error = new Error('Connection failed');

            const { engine } = createEngine([createPlugin('DatabasePlugin', PluginLifecycle.Error, error)]);

            const result = await engine.checkAll();

            expect(result[1]).toEqual(
                expect.objectContaining({
                    component: 'DatabasePlugin',
                    status: HealthStatus.Unhealthy,
                    details: {
                        plugin: 'DatabasePlugin',
                        error: 'Connection failed'
                    }
                })
            );
        });

        it.each([
            [PluginLifecycle.Created, HealthStatus.Unknown],
            [PluginLifecycle.Registered, HealthStatus.Unknown],
            [PluginLifecycle.Started, HealthStatus.Healthy],
            [PluginLifecycle.Stopped, HealthStatus.Unknown],
            [PluginLifecycle.Error, HealthStatus.Unhealthy],
            [undefined, HealthStatus.Unhealthy]
        ])('should map %s to %s', async (pluginState, expectedStatus) => {
            const { engine } = createEngine([createPlugin('Plugin', pluginState as any)]);

            const result = await engine.checkAll();

            expect(result[1].status).toBe(expectedStatus);
        });
    });

    describe('register', () => {
        it('should include registered checks after the plugins', async () => {
            const { engine } = createEngine([createPlugin('PluginA', PluginLifecycle.Started)]);
            engine.register(
                createIndicator(async () => ({ status: HealthStatus.Healthy, details: { latency: 3 } })),
                { name: 'database' }
            );

            const result = await engine.checkAll();

            expect(result).toHaveLength(3);
            expect(result[2]).toEqual({
                component: 'database',
                status: HealthStatus.Healthy,
                timestamp: expect.any(String),
                details: { latency: 3, critical: true }
            });
            expect(result[0].status).toBe(HealthStatus.Healthy);
            expect(result[0].details?.checks).toEqual([{ component: 'database', status: HealthStatus.Healthy, critical: true }]);
        });

        it('should use the class name when no name is provided', async () => {
            class CacheHealth extends HealthIndicator {
                async check(): Promise<HealthCheckResult> {
                    return { status: HealthStatus.Healthy };
                }
            }
            const { engine } = createEngine([]);
            engine.register(new CacheHealth());

            const result = await engine.checkAll();

            expect(result[1].component).toBe('CacheHealth');
        });

        it('should report the app as unhealthy when a critical check is unhealthy', async () => {
            const { engine } = createEngine([createPlugin('PluginA', PluginLifecycle.Started)]);
            engine.register(
                createIndicator(async () => ({ status: HealthStatus.Unhealthy })),
                { name: 'database' }
            );

            const result = await engine.checkAll();

            expect(result[0].status).toBe(HealthStatus.Unhealthy);
            expect(result[2].status).toBe(HealthStatus.Unhealthy);
        });

        it('should keep the app healthy when a non critical check is unhealthy', async () => {
            const { engine } = createEngine([createPlugin('PluginA', PluginLifecycle.Started)]);
            engine.register(
                createIndicator(async () => ({ status: HealthStatus.Unhealthy })),
                { name: 'cache', critical: false }
            );

            const result = await engine.checkAll();

            expect(result[0].status).toBe(HealthStatus.Healthy);
            expect(result[2]).toEqual(expect.objectContaining({ component: 'cache', status: HealthStatus.Unhealthy, details: { critical: false } }));
        });

        it('should report the app as unknown when a critical check is unknown', async () => {
            const { engine } = createEngine([]);
            engine.register(
                createIndicator(async () => ({ status: HealthStatus.Unknown })),
                { name: 'queue' }
            );

            const result = await engine.checkAll();

            expect(result[0].status).toBe(HealthStatus.Unknown);
        });

        it('should report a check that throws as unhealthy with the error message', async () => {
            const { engine } = createEngine([]);
            engine.register(
                createIndicator(async () => {
                    throw new Error('Connection refused');
                }),
                { name: 'database' }
            );

            const result = await engine.checkAll();

            expect(result[0].status).toBe(HealthStatus.Unhealthy);
            expect(result[1]).toEqual(
                expect.objectContaining({
                    component: 'database',
                    status: HealthStatus.Unhealthy,
                    details: { critical: true, error: 'Connection refused' }
                })
            );
        });

        it('should report a check that throws a non error value as unhealthy', async () => {
            const { engine } = createEngine([]);
            engine.register(
                createIndicator(() => Promise.reject('boom')),
                { name: 'database' }
            );

            const result = await engine.checkAll();

            expect(result[1].details).toEqual({ critical: true, error: 'boom' });
        });

        it('should report a check that exceeds its timeout as unhealthy', async () => {
            jest.useFakeTimers();
            try {
                const { engine } = createEngine([]);
                engine.register(
                    createIndicator(() => new Promise(() => undefined)),
                    { name: 'slow', timeout: 100 }
                );

                const promise = engine.checkAll();
                await jest.advanceTimersByTimeAsync(100);
                const result = await promise;

                expect(result[1]).toEqual(
                    expect.objectContaining({
                        component: 'slow',
                        status: HealthStatus.Unhealthy,
                        details: { critical: true, error: 'Health check timed out after 100ms' }
                    })
                );
            } finally {
                jest.useRealTimers();
            }
        });

        it('should run the checks in parallel', async () => {
            jest.useFakeTimers();
            try {
                const { engine } = createEngine([]);
                const delayed = () => new Promise<HealthCheckResult>((resolve) => setTimeout(() => resolve({ status: HealthStatus.Healthy }), 1000));
                engine.register(createIndicator(delayed), { name: 'first' });
                engine.register(createIndicator(delayed), { name: 'second' });

                const promise = engine.checkAll();
                await jest.advanceTimersByTimeAsync(1000);
                const result = await promise;

                expect(result.map((r) => r.status)).toEqual([HealthStatus.Healthy, HealthStatus.Healthy, HealthStatus.Healthy]);
            } finally {
                jest.useRealTimers();
            }
        });
    });

    describe('decorated checks', () => {
        class PaymentsApiHealth extends HealthIndicator {
            async check(): Promise<HealthCheckResult> {
                return { status: HealthStatus.Healthy };
            }
        }

        beforeAll(() => {
            HealthCheck({ name: 'payments-api', timeout: 2000, critical: false })(PaymentsApiHealth);
        });

        afterAll(() => {
            ClassRegistry.remove(PaymentsApiHealth);
        });

        it('should resolve the decorated checks through the container', async () => {
            const container = { resolve: jest.fn().mockResolvedValue(new PaymentsApiHealth()) };
            const { engine } = createEngine([], container);

            const result = await engine.checkAll();

            expect(container.resolve).toHaveBeenCalledWith(PaymentsApiHealth);
            expect(result[1]).toEqual(expect.objectContaining({ component: 'payments-api', status: HealthStatus.Healthy, details: { critical: false } }));
        });

        it('should report a check that cannot be resolved as unhealthy', async () => {
            const container = { resolve: jest.fn().mockRejectedValue(new Error('Provider not found')) };
            const { engine } = createEngine([], container);

            const result = await engine.checkAll();

            expect(result[1]).toEqual(
                expect.objectContaining({
                    component: 'payments-api',
                    status: HealthStatus.Unhealthy,
                    details: { critical: false, error: 'Provider not found' }
                })
            );
        });
    });

    describe('checkApp', () => {
        it('should return the application health', async () => {
            const { engine } = createEngine([createPlugin('PluginA', PluginLifecycle.Started)]);

            const app = await engine.checkApp();

            expect(app.component).toBe('AxisApp');
            expect(app.status).toBe(HealthStatus.Healthy);
        });

        it('should report plugin summary', async () => {
            const { engine } = createEngine([createPlugin('PluginA', PluginLifecycle.Started), createPlugin('PluginB', PluginLifecycle.Error)]);

            const app = await engine.checkApp();

            expect(app.details?.plugins).toEqual([
                expect.objectContaining({
                    component: 'PluginA',
                    status: HealthStatus.Healthy
                }),
                expect.objectContaining({
                    component: 'PluginB',
                    status: HealthStatus.Unhealthy
                })
            ]);
        });
    });
});
