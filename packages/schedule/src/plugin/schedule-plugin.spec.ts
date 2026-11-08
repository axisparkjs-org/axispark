import { SchedulePlugin } from './schedule-plugin';
import { JobGenerator } from '../jobs/job-generator';
import { SCHEDULE_LOGGER } from '../di/tokens';
import { SchedulerService } from '../scheduler';
import { InMemoryLockStore } from '@axisparkjs/store';
import { SchedulePluginOptionsFactory } from './schedule-plugin-options-factory';

describe('SchedulePlugin', () => {
    let plugin: SchedulePlugin;
    let jobGenerator: jest.Mocked<JobGenerator>;
    let logger: any;
    let scheduler: any;
    let injector: { get: jest.Mock };
    let context: any;
    const jobs = [
        { name: 'job1', type: 'type1', initiallyDisabled: false },
        { name: 'job2', type: 'type2', initiallyDisabled: true }
    ];

    beforeEach(() => {
        logger = {
            child: jest.fn().mockReturnThis(),
            info: jest.fn().mockResolvedValue(undefined),
            debug: jest.fn().mockResolvedValue(undefined)
        };

        scheduler = {
            registerJobs: jest.fn(),
            startAllJobs: jest.fn(),
            stopAllJobs: jest.fn(),
            startJob: jest.fn(),
            useLockStore: jest.fn()
        };

        jobGenerator = {
            generate: jest.fn()
        } as any;

        context = {
            container: {
                bind: jest.fn()
            }
        };

        injector = { get: jest.fn().mockResolvedValue(scheduler) };

        (jobGenerator.generate as jest.Mock).mockReturnValue(jobs);
        plugin = new SchedulePlugin(logger, jobGenerator, injector as any);
    });

    describe('onRegister', () => {
        it('should resolve the logger', async () => {
            await plugin.onRegister(context);

            expect(logger.child).toHaveBeenCalledWith('SchedulePlugin');
        });

        it('should register container bindings', async () => {
            await plugin.onRegister(context);

            expect(context.container.bind).toHaveBeenCalledWith({
                token: SCHEDULE_LOGGER,
                useValue: logger
            });
        });

        it('should initialize the scheduler', async () => {
            await plugin.onRegister(context);

            expect(jobGenerator.generate).toHaveBeenCalled();
            expect(jobGenerator.generate).toHaveBeenCalledWith();
            expect(injector.get).toHaveBeenCalledWith(SchedulerService);
            expect(scheduler.registerJobs).toHaveBeenCalledWith(jobs);
        });

        it('should log plugin registration', async () => {
            await plugin.onRegister(context);

            expect(logger.debug).toHaveBeenCalledWith('Registered job job1 of type type1 ');
            expect(logger.debug).toHaveBeenCalledWith('Registered job job2 of type type2 (initially disabled)');
            expect(logger.info).toHaveBeenCalledWith('Plugin registered');
        });
    });

    describe('onStart', () => {
        beforeEach(async () => {
            await plugin.onRegister(context);
            jest.clearAllMocks();
        });

        it('should start all jobs that are not disabled', async () => {
            await plugin.onStart();

            expect(scheduler.startAllJobs).toHaveBeenCalledWith(true);
        });

        it('should log plugin startup', async () => {
            await plugin.onStart();

            expect(logger.info).toHaveBeenCalledWith('Plugin started. Scheduler is running');
        });

        it('should use an in-memory lock store by default', async () => {
            await plugin.onStart();

            expect(scheduler.useLockStore).toHaveBeenCalledWith(expect.any(InMemoryLockStore));
        });

        it('should use the lock store created by the configured provider before starting the jobs', async () => {
            const store = { acquire: jest.fn() };
            const lockStore = jest.fn().mockImplementation(async () => {
                expect(scheduler.startAllJobs).not.toHaveBeenCalled();
                return store;
            });
            await plugin.onRegister(context, SchedulePluginOptionsFactory.create({ lockStore }));

            await plugin.onStart();

            expect(lockStore).toHaveBeenCalledWith('lock', context);
            expect(scheduler.useLockStore).toHaveBeenCalledWith(store);
            expect(scheduler.startAllJobs).toHaveBeenCalledWith(true);
        });
    });

    describe('onStop', () => {
        beforeEach(async () => {
            await plugin.onRegister(context);
            jest.clearAllMocks();
        });

        it('should stop all jobs with the default shutdown timeout', async () => {
            await plugin.onStop();

            expect(scheduler.stopAllJobs).toHaveBeenCalledWith({ timeout: 25_000 });
        });

        it('should stop all jobs with the configured shutdown timeout', async () => {
            await plugin.onRegister(context, SchedulePluginOptionsFactory.create({ shutdownTimeout: 1000 }));

            await plugin.onStop();

            expect(scheduler.stopAllJobs).toHaveBeenCalledWith({ timeout: 1000 });
        });

        it('should wait for the running jobs before logging that the plugin stopped', async () => {
            let resolveStop!: () => void;
            scheduler.stopAllJobs.mockReturnValue(new Promise<void>((resolve) => (resolveStop = resolve)));

            const promise = plugin.onStop();
            await Promise.resolve();

            expect(logger.info).not.toHaveBeenCalledWith('Plugin stopped');
            resolveStop();
            await promise;
            expect(logger.info).toHaveBeenCalledWith('Plugin stopped');
        });

        it('should log plugin shutdown', async () => {
            await plugin.onStop();

            expect(logger.info).toHaveBeenCalledWith('Plugin stopped');
        });
    });
});
