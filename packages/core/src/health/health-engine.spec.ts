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

    const createEngine = (plugins: any[], container: any = { resolve: jest.fn() }, healthChecks?: { cacheTtl?: number }) => {
        const config = {
            name: 'AxisApp',
            version: '1.0.0',
            healthChecks
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

    describe('shared and cached results', () => {
        let now: number;

        beforeEach(() => {
            now = 1_000;
            jest.spyOn(Date, 'now').mockImplementation(() => now);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should share a running check between concurrent health requests', async () => {
            let release: () => void = () => undefined;
            const first = new Promise<HealthCheckResult>((resolve) => (release = () => resolve({ status: HealthStatus.Healthy })));
            const indicator: HealthIndicator = { check: jest.fn().mockReturnValueOnce(first).mockResolvedValue({ status: HealthStatus.Healthy }) };
            const { engine } = createEngine([]);
            engine.register(indicator, { name: 'database' });

            const requests = Promise.all([engine.checkAll(), engine.checkApp()]);
            await new Promise((resolve) => setImmediate(resolve));
            release();
            const [all, app] = await requests;

            expect(indicator.check).toHaveBeenCalledTimes(1);
            expect(all[1].status).toBe(HealthStatus.Healthy);
            expect(app.status).toBe(HealthStatus.Healthy);
            await engine.checkAll();
            expect(indicator.check).toHaveBeenCalledTimes(2);
        });

        it('should reuse the result of a check during the cacheTtl of the application', async () => {
            const indicator = createIndicator(async () => ({ status: HealthStatus.Healthy }));
            const { engine } = createEngine([], undefined, { cacheTtl: 10_000 });
            engine.register(indicator, { name: 'broker' });

            await engine.checkAll();
            now += 9_999;
            const cached = await engine.checkAll();
            expect(indicator.check).toHaveBeenCalledTimes(1);
            expect(cached[1].timestamp).toBeDefined();

            now += 1;
            await engine.checkAll();
            expect(indicator.check).toHaveBeenCalledTimes(2);
        });

        it('should let a check override the cacheTtl of the application, and cache the failures too', async () => {
            const always = createIndicator(async () => ({ status: HealthStatus.Healthy }));
            const failing = createIndicator(async () => {
                throw new Error('down');
            });
            const { engine } = createEngine([], undefined, { cacheTtl: 10_000 });
            engine.register(always, { name: 'always', cacheTtl: 0 });
            engine.register(failing, { name: 'failing', cacheTtl: 5_000 });

            await engine.checkAll();
            now += 4_000;
            const result = await engine.checkAll();

            expect(always.check).toHaveBeenCalledTimes(2);
            expect(failing.check).toHaveBeenCalledTimes(1);
            expect(result[2]).toEqual(expect.objectContaining({ component: 'failing', status: HealthStatus.Unhealthy }));
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

        it('should cache the decorated checks with the cacheTtl of @HealthCheck', async () => {
            class CachedHealth extends HealthIndicator {
                async check(): Promise<HealthCheckResult> {
                    return { status: HealthStatus.Healthy };
                }
            }
            HealthCheck({ name: 'cached', cacheTtl: 60_000 })(CachedHealth);
            const indicator = new CachedHealth();
            const check = jest.spyOn(indicator, 'check');
            const container = { resolve: jest.fn().mockImplementation(async (target) => (target === CachedHealth ? indicator : new PaymentsApiHealth())) };
            const { engine } = createEngine([], container);

            await engine.checkAll();
            await engine.checkAll();

            expect(check).toHaveBeenCalledTimes(1);
            ClassRegistry.remove(CachedHealth);
        });

        it('should read the decorated checks from the registry once', async () => {
            const container = { resolve: jest.fn().mockResolvedValue(new PaymentsApiHealth()) };
            const { engine } = createEngine([], container);
            const getWithMetadata = jest.spyOn(ClassRegistry, 'getWithMetadata');

            await engine.checkAll();
            await engine.checkAll();
            const result = await engine.checkApp();

            expect(getWithMetadata).toHaveBeenCalledTimes(1);
            expect(container.resolve).toHaveBeenCalledTimes(3);
            expect(result.details?.checks).toEqual([{ component: 'payments-api', status: HealthStatus.Healthy, critical: false }]);
            getWithMetadata.mockRestore();
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
