import { DecoratorNotIncludedError, Injectable } from '@axisparkjs/di';
import { PluginOptions, Plugin, PluginLifecycle } from './plugin';
import { PluginRegistry } from './plugin-registry';
import { AxiSparkContext } from '../axispark';
import { PluginAlreadyRegisteredError } from './plugin-already-registered-error';
import { PluginConfigMismatchError } from './plugin-config-mismatch-error';
import { PluginCircularDependencyError } from './plugin-circular-dependency-error';
import { PluginDependencyNotIncludedError } from './plugin-dependency-not-included-error';

const onRegisterMock = jest.fn();
const onStartMock = jest.fn();
const onStopMock = jest.fn();

@Injectable()
class MockPlugin extends Plugin {
    async onRegister() {
        onRegisterMock();
    }
    async onStart() {
        onStartMock();
    }
    async onStop() {
        onStopMock();
    }
}
@Injectable()
class ErrorPlugin extends Plugin {
    async onRegister() {
        throw new Error('Error in onRegister');
    }
    async onStart() {
        throw new Error('Error in onStart');
    }
    async onStop() {
        throw new Error('Error in onStop');
    }
}
@Injectable()
class TestPlugin extends Plugin {}
class BrokenPlugin extends Plugin {
    async onRegister() {
        onRegisterMock();
    }
}

const executionOrder: string[] = [];

@Injectable()
class DependencyPlugin extends Plugin {
    async onRegister() {
        executionOrder.push('dependency');
    }
}

@Injectable()
class MainPlugin extends Plugin {
    static override dependencies = [DependencyPlugin];

    async onRegister() {
        executionOrder.push('main');
    }
}

@Injectable()
class MissingDependencyPlugin extends Plugin {
    static override dependencies = [DependencyPlugin];
}

@Injectable()
class ExtraMissingDependencyPlugin extends Plugin {
    static override dependencies = [DependencyPlugin, MissingDependencyPlugin];
}

@Injectable()
class CircularA extends Plugin {
    static override dependencies = [] as any;
}

@Injectable()
class CircularB extends Plugin {
    static override dependencies = [CircularA];
}

CircularA.dependencies = [CircularB];

@Injectable()
class OptionalDepTarget extends Plugin {
    async onRegister() {
        executionOrder.push('optional-target');
    }
}

@Injectable()
class OptionalDepPlugin extends Plugin {
    static override dependencies = [{ plugin: OptionalDepTarget, optional: true }];

    async onRegister() {
        executionOrder.push('optional-plugin');
    }
}

@Injectable()
class RequiredObjectDepPlugin extends Plugin {
    static override dependencies = [{ plugin: DependencyPlugin, optional: false }];

    async onRegister() {
        executionOrder.push('required-object-plugin');
    }
}

const timeline: string[] = [];
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
class SlowConnectionPlugin extends Plugin {
    async onStart() {
        timeline.push('slow:start');
        await delay(30);
        timeline.push('slow:started');
    }
    async onStop() {
        timeline.push('slow:stop');
    }
}

@Injectable()
class FastConnectionPlugin extends Plugin {
    async onStart() {
        timeline.push('fast:start');
        await delay(5);
        timeline.push('fast:started');
    }
    async onStop() {
        timeline.push('fast:stop');
    }
}

@Injectable()
class ConsumerPlugin extends Plugin {
    static override dependencies = [SlowConnectionPlugin, FastConnectionPlugin];

    async onStart() {
        timeline.push('consumer:start');
    }
    async onStop() {
        timeline.push('consumer:stop');
    }
}

describe('PluginRegistry', () => {
    let registry: PluginRegistry;
    let context: jest.Mocked<AxiSparkContext>;
    const mockOptions: PluginOptions = { plugin: MockPlugin };
    const testOptions: PluginOptions = { plugin: TestPlugin };

    beforeEach(() => {
        context = {
            logger: {
                info: jest.fn().mockResolvedValue(undefined),
                fatal: jest.fn().mockResolvedValue(undefined)
            },
            plugins: {
                init: jest.fn(),
                run: jest.fn(),
                destroy: jest.fn(),
                register: jest.fn()
            },
            container: {
                resolve: jest.fn(),
                bind: jest.fn()
            }
        } as unknown as jest.Mocked<AxiSparkContext>;
        registry = new PluginRegistry();
    });

    describe('register', () => {
        it('should register a decorated plugin', () => {
            registry.register(TestPlugin, testOptions);

            expect(registry.getAll()).toEqual([{ type: TestPlugin, options: testOptions }]);
        });

        it('should register multiple decorated plugins', () => {
            registry.register(TestPlugin, testOptions);
            registry.register(MockPlugin, mockOptions);

            expect(registry.getAll()).toEqual([
                { type: TestPlugin, options: testOptions },
                { type: MockPlugin, options: mockOptions }
            ]);
        });

        it('should throw if the class is not decorated with @Plugin', () => {
            expect(() => registry.register(BrokenPlugin, testOptions)).toThrow(DecoratorNotIncludedError);
        });

        it('should throw if the plugin is already registered', () => {
            registry.register(TestPlugin, testOptions);

            expect(() => registry.register(TestPlugin, testOptions)).toThrow(PluginAlreadyRegisteredError);
        });

        it('should throw if the plugin does not match the provided options', () => {
            const mismatchedOptions: PluginOptions = { plugin: MockPlugin };
            expect(() => registry.register(TestPlugin, mismatchedOptions)).toThrow(PluginConfigMismatchError);
        });
    });

    describe('getAll', () => {
        it('should return an empty array when no plugins are registered', () => {
            expect(registry.getAll()).toEqual([]);
        });

        it('should return all registered plugins in registration order', () => {
            registry.register(TestPlugin, testOptions);
            registry.register(MockPlugin, mockOptions);

            expect(registry.getAll()).toEqual([
                { type: TestPlugin, options: testOptions, instance: undefined },
                { type: MockPlugin, options: mockOptions, instance: undefined }
            ]);
        });
    });

    describe('lifecycle methods', () => {
        beforeEach(() => {
            executionOrder.length = 0;
        });

        it('should call onRegister, onStart, and onStop in order', async () => {
            const mockPluginInstance = new MockPlugin();
            const testPluginInstance = new TestPlugin();
            registry.register(MockPlugin, mockOptions);
            registry.register(TestPlugin, testOptions);
            context.container.resolve = jest.fn().mockImplementation((type) => {
                if (type === MockPlugin) return mockPluginInstance;
                if (type === TestPlugin) return testPluginInstance;
                throw new Error(`Unknown type: ${type}`);
            });

            await registry.init(context);
            expect(onRegisterMock).toHaveBeenCalledTimes(1);
            expect(mockPluginInstance.getState()).toBe(PluginLifecycle.Registered);

            await registry.run(context);
            expect(onStartMock).toHaveBeenCalledTimes(1);
            expect(mockPluginInstance.getState()).toBe(PluginLifecycle.Started);

            await registry.destroy(context);
            expect(onStopMock).toHaveBeenCalledTimes(1);
            expect(mockPluginInstance.getState()).toBe(PluginLifecycle.Stopped);
        });

        it('should handle errors in lifecycle methods gracefully', async () => {
            const errorPluginInstance = new ErrorPlugin();
            registry.register(ErrorPlugin, { plugin: ErrorPlugin });
            context.container.resolve = jest.fn().mockImplementation((type) => {
                if (type === ErrorPlugin) return errorPluginInstance;
                throw new Error(`Unknown type: ${type}`);
            });

            await expect(registry.init(context)).resolves.not.toThrow();
            expect(context.logger.fatal).toHaveBeenCalled();
            expect(errorPluginInstance.getState()).toBe(PluginLifecycle.Error);

            (context.logger.fatal as jest.Mock).mockClear();
            await expect(registry.run(context)).resolves.not.toThrow();
            expect(context.logger.fatal).not.toHaveBeenCalled();
            expect(errorPluginInstance.getState()).toBe(PluginLifecycle.Error);

            await expect(registry.destroy(context)).resolves.not.toThrow();
            expect(context.logger.fatal).not.toHaveBeenCalled();
            expect(errorPluginInstance.getState()).toBe(PluginLifecycle.Error);
        });

        it('should execute plugins respecting dependency order', async () => {
            registry.register(MainPlugin, { plugin: MainPlugin });
            registry.register(DependencyPlugin, { plugin: DependencyPlugin });
            registry.register(MissingDependencyPlugin, { plugin: MissingDependencyPlugin });
            registry.register(ExtraMissingDependencyPlugin);

            context.container.resolve = jest.fn().mockImplementation((type) => {
                if (type === MainPlugin) return new MainPlugin();
                if (type === DependencyPlugin) return new DependencyPlugin();
                if (type === MissingDependencyPlugin) return new MissingDependencyPlugin();
                if (type === ExtraMissingDependencyPlugin) return new ExtraMissingDependencyPlugin();
                throw new Error(`Unknown type: ${type}`);
            });

            await registry.init(context);

            expect(executionOrder).toEqual(['dependency', 'main']);
        });

        it('should throw if a dependency is not registered', async () => {
            registry.register(MissingDependencyPlugin, {
                plugin: MissingDependencyPlugin
            });

            context.container.resolve = jest.fn().mockImplementation((type) => {
                if (type === MissingDependencyPlugin) return new MissingDependencyPlugin();
                throw new Error(`Unknown type: ${type}`);
            });

            await expect(registry.init(context)).rejects.toThrow(PluginDependencyNotIncludedError);
        });

        it('should throw if circular dependencies are detected', async () => {
            registry.register(CircularA, { plugin: CircularA });
            registry.register(CircularB, { plugin: CircularB });

            context.container.resolve = jest.fn().mockImplementation((type) => {
                if (type === CircularA) return new CircularA();
                if (type === CircularB) return new CircularB();
                throw new Error(`Unknown type: ${type}`);
            });

            await expect(registry.init(context)).rejects.toThrow(PluginCircularDependencyError);
        });

        it('should allow optional dependencies when they are not registered', async () => {
            registry.register(OptionalDepPlugin, { plugin: OptionalDepPlugin });

            context.container.resolve = jest.fn().mockImplementation((type) => {
                if (type === OptionalDepPlugin) return new OptionalDepPlugin();
                throw new Error(`Unknown type: ${type}`);
            });

            await registry.init(context);
            expect(executionOrder).toEqual(['optional-plugin']);
        });

        it('should respect dependency order when optional dependency is registered', async () => {
            registry.register(OptionalDepPlugin, { plugin: OptionalDepPlugin });
            registry.register(OptionalDepTarget, { plugin: OptionalDepTarget });

            context.container.resolve = jest.fn().mockImplementation((type) => {
                if (type === OptionalDepPlugin) return new OptionalDepPlugin();
                if (type === OptionalDepTarget) return new OptionalDepTarget();
                throw new Error(`Unknown type: ${type}`);
            });

            await registry.init(context);
            expect(executionOrder).toEqual(['optional-target', 'optional-plugin']);
        });

        it('should respect object-style required dependencies', async () => {
            registry.register(RequiredObjectDepPlugin, { plugin: RequiredObjectDepPlugin });
            registry.register(DependencyPlugin, { plugin: DependencyPlugin });

            context.container.resolve = jest.fn().mockImplementation((type) => {
                if (type === RequiredObjectDepPlugin) return new RequiredObjectDepPlugin();
                if (type === DependencyPlugin) return new DependencyPlugin();
                throw new Error(`Unknown type: ${type}`);
            });

            await registry.init(context);
            expect(executionOrder).toEqual(['dependency', 'required-object-plugin']);
        });
    });
    describe('levels of the dependency graph', () => {
        const resolveNew = () => {
            const instances = new Map<unknown, Plugin>();
            return jest.fn().mockImplementation((type) => {
                if (!instances.has(type)) instances.set(type, new type());
                return instances.get(type);
            });
        };
        const registerAll = (target: PluginRegistry) => {
            target.register(ConsumerPlugin);
            target.register(SlowConnectionPlugin);
            target.register(FastConnectionPlugin);
        };

        beforeEach(() => {
            timeline.length = 0;
            context.container.resolve = resolveNew();
        });

        it('should start the independent plugins at the same time and their dependents after them', async () => {
            registerAll(registry);
            await registry.init(context);

            await registry.run(context);

            expect(timeline).toEqual(['slow:start', 'fast:start', 'fast:started', 'slow:started', 'consumer:start']);
        });

        it('should stop the plugins level by level in reverse order', async () => {
            registerAll(registry);
            await registry.init(context);
            await registry.run(context);
            timeline.length = 0;

            await registry.destroy(context);

            expect(timeline).toEqual(['consumer:stop', 'slow:stop', 'fast:stop']);
        });

        it('should run the plugins one by one when parallel is false', async () => {
            const sequential = new PluginRegistry({ parallel: false });
            registerAll(sequential);
            await sequential.init(context);

            await sequential.run(context);

            expect(timeline).toEqual(['slow:start', 'slow:started', 'fast:start', 'fast:started', 'consumer:start']);
        });

        it('should keep running the other plugins of a level when one of them fails', async () => {
            registry.register(ErrorPlugin);
            registry.register(SlowConnectionPlugin);
            context.container.resolve = jest.fn().mockImplementation((type) => (type === ErrorPlugin ? new ErrorPlugin() : new type()));
            await registry.init(context);

            await registry.run(context);

            expect(timeline).toEqual(['slow:start', 'slow:started']);
            expect(registry.getAll()[0].instance?.getState()).toBe(PluginLifecycle.Error);
            expect(registry.getAll()[1].instance?.getState()).toBe(PluginLifecycle.Started);
        });
    });
});
