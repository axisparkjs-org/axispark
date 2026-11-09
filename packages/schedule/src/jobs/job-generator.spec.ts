import { ClassRegistry } from '@axisparkjs/di';
import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { JobDefinition } from './job-definition';
import { JobGenerator } from './job-generator';
import { JobType } from './job-definition';

jest.mock('@axisparkjs/di', () => {
    const originalModule = jest.requireActual('@axisparkjs/di');
    return {
        ...originalModule,
        ClassRegistry: {
            getWithMetadata: jest.fn()
        }
    };
});

jest.mock('@axisparkjs/common', () => ({
    Metadata: {
        get: jest.fn(),
        define: jest.fn(),
        remove: jest.fn(),
        normalizeTarget: jest.fn((target) => target)
    },
    MetadataKeys: {
        SCHEDULER: 'scheduler',
        JOB: 'job'
    }
}));

describe('JobGenerator', () => {
    let jobGenerator: JobGenerator;
    let injector: { get: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();

        injector = { get: jest.fn() };
        jobGenerator = new JobGenerator(injector as any);

        jest.spyOn(JobDefinition, 'fromMetadata').mockImplementation((metadata, execute) => ({ ...metadata, execute }) as any);
    });

    it('should return an empty array when there are no schedulers', async () => {
        (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([]);

        expect(await jobGenerator.generate()).toEqual([]);

        expect(ClassRegistry.getWithMetadata).toHaveBeenCalledWith(MetadataKeys.SCHEDULER);
    });

    it('should ignore schedulers without jobs', async () => {
        class Scheduler {}

        (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([Scheduler]);

        (Metadata.get as jest.Mock).mockReturnValue(undefined);

        expect(await jobGenerator.generate()).toEqual([]);

        expect(Metadata.get).toHaveBeenCalledWith(MetadataKeys.JOB, Scheduler);
    });

    it('should generate jobs from scheduler metadata', async () => {
        class Scheduler {}

        class SchedulerInstance {
            execute = jest.fn().mockResolvedValue(undefined);
        }

        const metadata = [
            {
                name: 'job',
                type: JobType.Interval,
                value: 1000,
                target: Scheduler,
                propertyKey: 'execute'
            }
        ];

        (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([Scheduler]);

        (Metadata.get as jest.Mock).mockReturnValue(metadata);

        const instance = new SchedulerInstance();

        injector.get.mockResolvedValue(instance);

        const jobs = await jobGenerator.generate();

        expect(injector.get).not.toHaveBeenCalled();

        expect(JobDefinition.fromMetadata).toHaveBeenCalledWith(
            {
                name: 'job',
                type: JobType.Interval,
                value: 1000,
                target: Scheduler,
                propertyKey: 'execute'
            },
            expect.any(Function)
        );

        expect(jobs).toEqual([expect.objectContaining({ name: 'job', type: JobType.Interval, value: 1000 })]);

        const signal = new AbortController().signal;
        await jobs[0].execute(signal);
        expect(injector.get).toHaveBeenCalledWith(Scheduler);
        expect(instance.execute).toHaveBeenCalledTimes(1);
        expect(instance.execute).toHaveBeenCalledWith(signal);
    });

    it('should bind the method to the resolved instance', async () => {
        class Scheduler {}

        class SchedulerInstance {
            value = 42;

            async execute() {
                return this.value;
            }
        }

        (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([Scheduler]);

        (Metadata.get as jest.Mock).mockReturnValue([
            {
                name: 'job',
                type: JobType.Timeout,
                value: 100,
                target: Scheduler,
                propertyKey: 'execute'
            }
        ]);

        const instance = new SchedulerInstance();

        injector.get.mockResolvedValue(instance);

        const jobs = await jobGenerator.generate();

        await expect(jobs[0].execute()).resolves.toBeUndefined();
        expect(injector.get).toHaveBeenCalledWith(Scheduler);
        expect(instance.value).toBe(42);
    });

    it('should generate jobs from multiple schedulers', async () => {
        class Scheduler1 {}
        class Scheduler2 {}

        (ClassRegistry.getWithMetadata as jest.Mock).mockReturnValue([Scheduler1, Scheduler2]);

        (Metadata.get as jest.Mock)
            .mockReturnValueOnce([
                {
                    name: 'job1',
                    type: JobType.Interval,
                    value: 1000,
                    target: Scheduler1,
                    propertyKey: 'execute'
                }
            ])
            .mockReturnValueOnce([
                {
                    name: 'job2',
                    type: JobType.Timeout,
                    value: 500,
                    target: Scheduler2,
                    propertyKey: 'execute'
                }
            ]);

        injector.get
            .mockReturnValueOnce({
                execute: jest.fn()
            })
            .mockReturnValueOnce({
                execute: jest.fn()
            });

        (JobDefinition.fromMetadata as jest.Mock).mockReturnValueOnce({ id: 1 }).mockReturnValueOnce({ id: 2 });

        expect(await jobGenerator.generate()).toEqual([{ id: 1 }, { id: 2 }]);

        expect(JobDefinition.fromMetadata).toHaveBeenCalledTimes(2);
    });
});
