import { Container, ClassRegistry, Injectable } from '@axisparkjs/di';
import { ClassType, Metadata, MetadataKeys } from '@axisparkjs/common';
import { PluginRegistry } from '../plugin';
import { HealthData } from './health-data';
import { PluginLifecycle, Plugin } from '../plugin/plugin';
import { AxiSparkConfig } from '../axispark/axispark-config';
import { HealthStatus } from './health-status';
import { HealthIndicator } from './health-indicator';
import { DEFAULT_HEALTH_CHECK_TIMEOUT, HealthCheckOptions } from './health-check-options';
import { HealthCheckMetadata } from './health-check-metadata';

/**
 * An internal representation of a health check that can be run by the `HealthEngine`.
 */
interface HealthCheckEntry {
    name: string;
    timeout: number;
    critical: boolean;
    cacheTtl?: number;
    /** The object that identifies the check between health requests: the indicator registered, or the decorated class. */
    key: object;
    resolve: () => Promise<HealthIndicator>;
}

/** The last result of a check, and the check that is running. */
interface HealthCheckState {
    data?: HealthData;
    expiresAt: number;
    pending?: Promise<HealthData>;
}

/**
 * A class for managing and checking the health of the application, its plugins and its health checks. It provides methods to check the health status of all registered plugins and health checks, and the overall application health. The health status is represented using the `HealthData` interface, which includes information about each component's health, such as its name, current status, timestamp, and optional details. The class uses the `PluginRegistry` to access all registered plugins and determine their health based on their lifecycle state, and runs the health checks decorated with `@HealthCheck` or registered by plugins.
 *
 * Methods:
 * - `register(indicator, options)`: Registers a health indicator, typically from a plugin, so that it is run with every health check.
 * - `checkAll()`: Checks the health status of all registered plugins and health checks and returns an array of `HealthData` objects representing the health of each component, including the overall application health.
 * - `checkApp()`: Checks the overall health status of the application and returns a single `HealthData` object representing the application's health.
 *
 * Concurrent health requests share the checks that are running, and the result of a check is reused for `cacheTtl` milliseconds (of the
 * check, or `healthChecks.cacheTtl` of the application), so frequent probes do not run the indicators every time.
 *
 * The checks decorated with `@HealthCheck` are read from the `ClassRegistry` the first time the health is checked, when every file has been
 * scanned, and the list is reused by the next checks.
 *
 * The `HealthEngine` class is designed to be used in applications that require monitoring and reporting of component health, providing a structured way to assess the state of the application, its plugins and its external dependencies.
 */
@Injectable()
export class HealthEngine {
    private readonly registeredChecks: HealthCheckEntry[] = [];
    private readonly checkStates = new WeakMap<object, HealthCheckState>();
    private decoratedChecks?: HealthCheckEntry[];

    constructor(
        private readonly config: AxiSparkConfig,
        private readonly plugins: PluginRegistry,
        private readonly container: Container
    ) {}

    /**
     * Registers a health indicator so that it is run every time the health of the application is checked. It is used by plugins to register the checks of their connections.
     * @param indicator The health indicator to register.
     * @param options The options of the health check.
     */
    public register(indicator: HealthIndicator, options?: HealthCheckOptions): void {
        this.registeredChecks.push({
            name: options?.name ?? indicator.constructor.name,
            timeout: options?.timeout ?? DEFAULT_HEALTH_CHECK_TIMEOUT,
            critical: options?.critical ?? true,
            cacheTtl: options?.cacheTtl,
            key: indicator,
            resolve: async () => indicator
        });
    }

    /**
     * Checks the health status of all registered plugins and health checks and returns an array of `HealthData` objects representing the health of each component, including the overall application health. The health checks are run in parallel, each one with its timeout. The application is `Unhealthy` if any plugin or critical health check is unhealthy.
     * @returns A promise resolving to an array of `HealthData` objects representing the health status of each component, including the overall application health.
     */
    public async checkAll(): Promise<HealthData[]> {
        const pluginHealthDatas: HealthData[] = this.plugins.getAll().map(({ type, instance }) => {
            return {
                component: type.name,
                timestamp: new Date().toISOString(),
                status: this.mapPluginStateToHealthData((instance as Plugin).getState()),
                details: {
                    plugin: type.name,
                    error: (instance as Plugin).getStateError()?.message
                }
            };
        });
        const checks = [...this.registeredChecks, ...this.getDecoratedChecks()];
        const checkHealthDatas = await Promise.all(checks.map((check) => this.runSharedCheck(check)));

        const relevantHealthDatas = [...pluginHealthDatas, ...checkHealthDatas.filter((_, index) => checks[index].critical)];
        const unhealthyPresence = relevantHealthDatas.some((state) => state.status === HealthStatus.Unhealthy);
        const statusOverall = unhealthyPresence ? HealthStatus.Unhealthy : HealthStatus.Unknown;
        const appState: HealthData = {
            component: this.config.name as string,
            timestamp: new Date().toISOString(),
            status: relevantHealthDatas.every((state) => state.status === HealthStatus.Healthy) ? HealthStatus.Healthy : statusOverall,
            details: {
                plugins: pluginHealthDatas.map((state) => ({
                    component: state.component,
                    status: state.status
                })),
                checks: checkHealthDatas.map((state, index) => ({
                    component: state.component,
                    status: state.status,
                    critical: checks[index].critical
                }))
            }
        };
        return [appState, ...pluginHealthDatas, ...checkHealthDatas];
    }

    /**
     * Checks the health status of the application and returns a `HealthData` object representing the overall application health.
     * @returns A promise resolving to a `HealthData` object representing the overall application health.
     */
    public async checkApp(): Promise<HealthData> {
        const healthDatas = await this.checkAll();
        return healthDatas[0];
    }

    /* The checks decorated with @HealthCheck, read from the registry and the metadata on the first health check, after the scan. */
    private getDecoratedChecks(): HealthCheckEntry[] {
        this.decoratedChecks ??= ClassRegistry.getWithMetadata(MetadataKeys.HEALTH_CHECK).map((target) => {
            const metadata = Metadata.get<HealthCheckMetadata>(MetadataKeys.HEALTH_CHECK, target) as HealthCheckMetadata;
            return {
                name: metadata.name,
                timeout: metadata.timeout,
                critical: metadata.critical,
                cacheTtl: metadata.cacheTtl,
                key: target,
                resolve: async () => await this.container.resolve(metadata.target as ClassType<HealthIndicator>)
            };
        });
        return this.decoratedChecks;
    }

    /*
     * Runs a check, unless its last result is still valid (cacheTtl) or the check is already running for another health request, whose
     * result is shared. The checks never reject: their failures are results.
     */
    private runSharedCheck(check: HealthCheckEntry): Promise<HealthData> {
        let state = this.checkStates.get(check.key);
        if (!state) {
            state = { expiresAt: 0 };
            this.checkStates.set(check.key, state);
        }

        if (state.data && state.expiresAt > Date.now()) return Promise.resolve(state.data);
        if (state.pending) return state.pending;

        const ttl = check.cacheTtl ?? this.config.healthChecks?.cacheTtl ?? 0;
        const current = state;
        current.pending = this.runCheck(check).then((data) => {
            current.pending = undefined;
            if (ttl > 0) {
                current.data = data;
                current.expiresAt = Date.now() + ttl;
            }
            return data;
        });
        return current.pending;
    }

    private async runCheck(check: HealthCheckEntry): Promise<HealthData> {
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Health check timed out after ${check.timeout}ms`)), check.timeout);
        });

        try {
            const result = await Promise.race([check.resolve().then((indicator) => indicator.check()), timeout]);
            return {
                component: check.name,
                timestamp: new Date().toISOString(),
                status: result.status,
                details: { ...result.details, critical: check.critical }
            };
        } catch (error) {
            return {
                component: check.name,
                timestamp: new Date().toISOString(),
                status: HealthStatus.Unhealthy,
                details: { critical: check.critical, error: error instanceof Error ? error.message : String(error) }
            };
        } finally {
            clearTimeout(timer);
        }
    }

    private mapPluginStateToHealthData(pluginState: PluginLifecycle | undefined): HealthStatus {
        switch (pluginState) {
            case PluginLifecycle.Created:
            case PluginLifecycle.Registered:
            case PluginLifecycle.Stopped:
                return HealthStatus.Unknown;
            case PluginLifecycle.Started:
                return HealthStatus.Healthy;
            case PluginLifecycle.Error:
                return HealthStatus.Unhealthy;
            default:
                return HealthStatus.Unhealthy;
        }
    }
}
