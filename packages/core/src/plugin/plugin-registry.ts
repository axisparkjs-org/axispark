import { Metadata, MetadataKeys, Lifecycle } from '@axisparkjs/common';
import { DecoratorNotIncludedError, Injectable } from '@axisparkjs/di';
import { AxiSparkContext } from '../axispark';
import { PluginAlreadyRegisteredError } from './plugin-already-registered-error';
import { PluginConfigMismatchError } from './plugin-config-mismatch-error';
import { PluginCircularDependencyError } from './plugin-circular-dependency-error';
import { PluginDependencyNotIncludedError } from './plugin-dependency-not-included-error';
import { PluginDependencyFailedError } from './plugin-dependency-failed-error';
import { Plugin, PluginLifecycle, PluginType, PluginOptions } from './plugin';

interface RegisteredPlugin {
    readonly type: PluginType;
    readonly options?: PluginOptions;
}

interface NormalizedDependency {
    readonly type: PluginType;
    readonly optional: boolean;
}

/**
 * Options of the plugin registry.
 */
export interface PluginRegistryOptions {
    /**
     * Whether the plugins of the same level of the dependency graph run their lifecycle methods at the same time. When `false`, the plugins
     * run them one by one, in dependency order. Defaults to `true`.
     */
    parallel?: boolean;
}

/**
 * A registry for managing plugins and their lifecycle. The plugins are grouped by level of the dependency graph: the first level has the
 * plugins without dependencies, and each next level has the plugins whose dependencies are in the previous levels. The plugins of a level
 * run `onRegister` and `onStart` at the same time, after the previous level ends. `onStop` runs one plugin at a time, in the reverse of the
 * dependency order, because a plugin can use the connections of another one without declaring it (such as a shared store).
 */
export class PluginRegistry implements Lifecycle {
    private readonly plugins: RegisteredPlugin[] = [];
    private readonly levels: RegisteredPlugin[][] = [];
    private readonly instances = new Map<PluginType, Plugin>();
    private readonly requiredDependencies = new Map<PluginType, PluginType[]>();

    /**
     * Creates a new plugin registry.
     * @param options The options of the registry.
     */
    constructor(private readonly options: PluginRegistryOptions = {}) {}

    /**
     * Registers a new plugin with the registry.
     * @param plugin The type of the plugin to register.
     * @param options The options for the plugin.
     */
    register(plugin: PluginType, options?: PluginOptions): void {
        if (!Metadata.has(MetadataKeys.INJECTABLE, plugin)) throw new DecoratorNotIncludedError(plugin.name, Injectable.name);
        if (this.plugins.some((p) => p.type === plugin)) throw new PluginAlreadyRegisteredError(plugin.name);
        if (options && plugin !== options.plugin) throw new PluginConfigMismatchError(plugin.name);

        this.plugins.push({ type: plugin, options });
    }

    /**
     * Retrieves all registered plugins along with their options and instances.
     * @returns An array of objects containing the plugin type, options, and instance.
     */
    getAll(): readonly { type: PluginType; options?: PluginOptions; instance?: Plugin }[] {
        return this.plugins.map((p) => ({ type: p.type, options: p.options, instance: this.instances.get(p.type) }));
    }

    private static normalizeDependency(dependency: PluginType | { plugin: PluginType; optional: boolean }): NormalizedDependency {
        if (typeof dependency === 'function') {
            return { type: dependency, optional: false };
        }
        return { type: dependency.plugin, optional: dependency.optional };
    }

    /* Kahn's algorithm */
    private resolveExecutionOrder(): void {
        this.levels.length = 0;
        this.requiredDependencies.clear();
        const plugins = new Map(this.plugins.map((plugin) => [plugin.type, plugin]));
        const inDegree = new Map<PluginType, number>();
        const graph = new Map<PluginType, PluginType[]>();

        for (const plugin of this.plugins) {
            inDegree.set(plugin.type, 0);
            graph.set(plugin.type, []);
            this.requiredDependencies.set(plugin.type, []);
        }

        for (const plugin of this.plugins) {
            const dependencies = plugin.type.dependencies || [];
            for (const rawDependency of dependencies) {
                const { type: dependencyType, optional } = PluginRegistry.normalizeDependency(rawDependency);

                if (!graph.has(dependencyType)) {
                    if (optional) continue;
                    throw new PluginDependencyNotIncludedError(dependencyType.name);
                }

                if (!optional) (this.requiredDependencies.get(plugin.type) as PluginType[]).push(dependencyType);

                // If the dependency is registered, the order is respected even when it is optional.
                (graph.get(dependencyType) as PluginType[]).push(plugin.type);
                inDegree.set(plugin.type, (inDegree.get(plugin.type) || 0) + 1);
            }
        }

        let level: PluginType[] = [];
        for (const [plugin, degree] of inDegree.entries()) {
            if (degree === 0) level.push(plugin);
        }

        let resolved = 0;
        while (level.length > 0) {
            this.levels.push(level.map((type) => plugins.get(type) as RegisteredPlugin));
            resolved += level.length;

            const next: PluginType[] = [];
            for (const current of level) {
                for (const neighbor of graph.get(current) as PluginType[]) {
                    inDegree.set(neighbor, (inDegree.get(neighbor) as number) - 1);
                    if (inDegree.get(neighbor) === 0) next.push(neighbor);
                }
            }
            level = next;
        }

        if (resolved !== this.plugins.length) {
            throw new PluginCircularDependencyError();
        }
    }

    /**
     * Initializes the registered plugins by executing their `onRegister` lifecycle method.
     * @param context The AxiSparkContext to be passed to the plugins during initialization.
     */
    async init(context: AxiSparkContext): Promise<void> {
        this.resolveExecutionOrder();
        await this.executeLifecycleMethod(context, 'onRegister', PluginLifecycle.Registered);
    }

    /**
     * Starts the registered plugins by executing their `onStart` lifecycle method.
     * @param context The AxiSparkContext to be passed to the plugins during startup.
     */
    async run(context: AxiSparkContext): Promise<void> {
        await this.executeLifecycleMethod(context, 'onStart', PluginLifecycle.Started);
    }

    /**
     * Destroys the registered plugins by executing their `onStop` lifecycle method one by one, in the reverse of the dependency order.
     * @param context The AxiSparkContext to be passed to the plugins during destruction.
     */
    async destroy(context: AxiSparkContext): Promise<void> {
        await this.executeLifecycleMethod(context, 'onStop', PluginLifecycle.Stopped, true);
    }

    private async executeLifecycleMethod(
        context: AxiSparkContext,
        methodName: 'onRegister' | 'onStart' | 'onStop',
        lifecycleState: PluginLifecycle,
        reversed = false
    ): Promise<void> {
        // onStop runs one plugin at a time, in the reverse of the dependency order: a plugin can use the connections of another plugin
        // without declaring it as a dependency (for example through the store of a StoreProvider, or an injected client), so a plugin is
        // always stopped before the plugins registered before it, and the work that it finishes while stopping can still use them.
        if (reversed) {
            for (const plugin of this.levels.flat().toReversed()) await this.executePlugin(context, plugin, methodName, lifecycleState);
            return;
        }

        for (const level of this.levels) {
            if (this.options.parallel === false) {
                for (const plugin of level) await this.executePlugin(context, plugin, methodName, lifecycleState);
            } else {
                await Promise.all(level.map((plugin) => this.executePlugin(context, plugin, methodName, lifecycleState)));
            }
        }
    }

    /*
     * Runs one lifecycle method of one plugin. A plugin in the Error state is skipped, and so is a plugin whose required dependency is in the
     * Error state (the dependencies are in previous levels, so their state is final). An error never stops the other plugins.
     */
    private async executePlugin(
        context: AxiSparkContext,
        { type, options }: RegisteredPlugin,
        methodName: 'onRegister' | 'onStart' | 'onStop',
        lifecycleState: PluginLifecycle
    ): Promise<void> {
        let instance;
        if (methodName === 'onRegister') {
            instance = await context.container.resolve<Plugin>(type);
            this.instances.set(type, instance);
        } else {
            instance = this.instances.get(type) as Plugin;
        }

        if (instance.getState() === PluginLifecycle.Error) return;
        if (methodName !== 'onStop' && this.skipIfDependencyFailed(context, type, instance)) return;

        try {
            await instance[methodName]?.(context, options);
            instance.setState(lifecycleState);
        } catch (error) {
            instance.setStateError(error as Error);
            context.logger.fatal(`Error executing ${methodName} for plugin ${type.name}: ${error}`, error as Error);
        }
    }

    /* A plugin cannot register or start when one of its required dependencies is in the Error state. */
    private skipIfDependencyFailed(context: AxiSparkContext, type: PluginType, instance: Plugin): boolean {
        const failed = (this.requiredDependencies.get(type) as PluginType[]).find(
            (dependency) => this.instances.get(dependency)?.getState() === PluginLifecycle.Error
        );
        if (!failed) return false;

        const error = new PluginDependencyFailedError(type.name, failed.name);
        instance.setStateError(error);
        context.logger.fatal(error.message, error);
        return true;
    }
}
