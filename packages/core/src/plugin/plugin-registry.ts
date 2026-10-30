import { Metadata, MetadataKeys, Lifecycle } from '@axisparkjs/common';
import { DecoratorNotIncludedError, Injectable } from '@axisparkjs/di';
import { AxiSparkContext } from '../axispark';
import { PluginAlreadyRegisteredError } from './plugin-already-registered-error';
import { PluginConfigMismatchError } from './plugin-config-mismatch-error';
import { PluginCircularDependencyError } from './plugin-circular-dependency-error';
import { PluginDependencyNotIncludedError } from './plugin-dependency-not-included-error';
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
 * A registry for managing plugins and their lifecycle.
 */
export class PluginRegistry implements Lifecycle {
    private readonly plugins: RegisteredPlugin[] = [];
    private readonly executionOrder: RegisteredPlugin[] = [];
    private readonly instances = new Map<PluginType, Plugin>();

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
        this.executionOrder.length = 0;
        const plugins = new Map(this.plugins.map((plugin) => [plugin.type, plugin]));
        const inDegree = new Map<PluginType, number>();
        const graph = new Map<PluginType, PluginType[]>();

        for (const plugin of this.plugins) {
            inDegree.set(plugin.type, 0);
            graph.set(plugin.type, []);
        }

        for (const plugin of this.plugins) {
            const dependencies = plugin.type.dependencies || [];
            for (const rawDependency of dependencies) {
                const { type: dependencyType, optional } = PluginRegistry.normalizeDependency(rawDependency);

                if (!graph.has(dependencyType)) {
                    if (optional) continue;
                    throw new PluginDependencyNotIncludedError(dependencyType.name);
                }

                // If the dependency is registered, the order is respected even when it is optional.
                (graph.get(dependencyType) as PluginType[]).push(plugin.type);
                inDegree.set(plugin.type, (inDegree.get(plugin.type) || 0) + 1);
            }
        }

        const queue: PluginType[] = [];
        for (const [plugin, degree] of inDegree.entries()) {
            if (degree === 0) queue.push(plugin);
        }

        while (queue.length > 0) {
            const current = queue.shift() as PluginType;
            const currentPlugin = plugins.get(current) as RegisteredPlugin;
            this.executionOrder.push(currentPlugin);

            for (const neighbor of graph.get(current) as PluginType[]) {
                inDegree.set(neighbor, (inDegree.get(neighbor) as number) - 1);
                if (inDegree.get(neighbor) === 0) queue.push(neighbor);
            }
        }

        if (this.executionOrder.length !== this.plugins.length) {
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
     * Destroys the registered plugins by executing their `onStop` lifecycle method in reverse order.
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
        const plugins = reversed ? this.executionOrder.toReversed() : this.executionOrder;
        for (const { type, options } of plugins) {
            let instance;
            if (methodName === 'onRegister') {
                instance = await context.container.resolve<Plugin>(type);
                this.instances.set(type, instance);
            } else {
                instance = this.instances.get(type) as Plugin;
            }

            try {
                if (instance.getState() === PluginLifecycle.Error) return;

                await instance[methodName]?.(context, options);
                instance.setState(lifecycleState);
            } catch (error) {
                instance.setStateError(error as Error);
                context.logger.fatal(`Error executing ${methodName} for plugin ${type.name}: ${error}`, error as Error);
            }
        }
    }
}
