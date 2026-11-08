import { SchedulerService } from './scheduler-service';
import { SchedulerRegistry } from './scheduler-registry';
import { SchedulerRunner } from './scheduler-runner';
import { SchedulerError } from '../errors';
import { JobDefinition, JobType } from '../jobs';

class TestJob extends JobDefinition {
    readonly type = JobType.Timeout;

    protected trigger = {
        getNextExecutionTime: jest.fn()
    } as any;
}

describe('SchedulerService', () => {
    let registry: jest.Mocked<SchedulerRegistry>;
    let runner: jest.Mocked<SchedulerRunner>;
    let service: SchedulerService;

    beforeEach(() => {
        registry = {
            registerJob: jest.fn(),
            getJob: jest.fn(),
            getAllJobs: jest.fn()
        } as any;

        runner = {
            start: jest.fn(),
            stop: jest.fn(),
            startAll: jest.fn(),
            stopAll: jest.fn(),
            isRunning: jest.fn(),
            useLockStore: jest.fn()
        } as any;

        service = new SchedulerService(registry, runner);
    });

    const createJob = (name = 'job') => new TestJob(name, jest.fn().mockResolvedValue(undefined));

    it('should pass the lock store to the runner', () => {
        const store = { acquire: jest.fn() };

        service.useLockStore(store);

        expect(runner.useLockStore).toHaveBeenCalledWith(store);
    });
    const createInitiallyDisabledJob = (name = 'job') => new TestJob(name, jest.fn().mockResolvedValue(undefined), true);

    describe('registerJob', () => {
        it('should register a job', () => {
            const job = createJob();

            service.registerJob(job);

            expect(registry.registerJob).toHaveBeenCalledWith(job);
            expect(runner.start).not.toHaveBeenCalled();
        });
    });

    describe('registerJobs', () => {
        it('should register every job', () => {
            const jobs = [createJob('a'), createJob('b')];

            service.registerJobs(jobs);

            expect(registry.registerJob).toHaveBeenCalledTimes(2);
        });
    });

    describe('startJob', () => {
        it('should start a registered job by name', () => {
            const job = createJob();

            registry.getJob.mockReturnValue(job);

            service.startJob('job');

            expect(runner.start).toHaveBeenCalledWith(job);
        });

        it('should throw when the name is unknown', () => {
            registry.getJob.mockReturnValue(undefined);

            expect(() => service.startJob('missing')).toThrow(SchedulerError);
        });

        it('should register and start an unregistered job instance', () => {
            const job = createJob();

            registry.getJob.mockReturnValue(undefined);

            service.startJob(job);

            expect(registry.registerJob).toHaveBeenCalledWith(job);
            expect(runner.start).toHaveBeenCalledWith(job);
        });

        it('should start a registered job instance', () => {
            const job = createJob();

            registry.getJob.mockReturnValue(job);

            service.startJob(job);

            expect(registry.registerJob).not.toHaveBeenCalled();
            expect(runner.start).toHaveBeenCalledWith(job);
        });
    });

    describe('startAllJobs', () => {
        it('should start every registered job', () => {
            const jobs = [createJob('a'), createJob('b')];

            registry.getAllJobs.mockReturnValue(jobs);

            service.startAllJobs();

            expect(runner.startAll).toHaveBeenCalledWith(jobs);
        });

        it('should start only jobs that are not marked as disabled', () => {
            const jobs = [createInitiallyDisabledJob('a'), createJob('b')];
            registry.getAllJobs.mockReturnValue(jobs);
            service.startAllJobs(true);
            expect(runner.startAll).toHaveBeenCalledWith([jobs[1]]);
        });
    });

    describe('stopJob', () => {
        it('should stop a registered job by name', () => {
            const job = createJob();

            registry.getJob.mockReturnValue(job);

            service.stopJob('job');

            expect(runner.stop).toHaveBeenCalledWith(job);
        });

        it('should stop a registered job instance', () => {
            const job = createJob();

            registry.getJob.mockReturnValue(job);

            service.stopJob(job);

            expect(runner.stop).toHaveBeenCalledWith(job);
        });

        it('should do nothing when the job does not exist', () => {
            registry.getJob.mockReturnValue(undefined);

            service.stopJob('missing');

            expect(runner.stop).not.toHaveBeenCalled();
        });
    });

    describe('stopAllJobs', () => {
        it('should stop every registered job', () => {
            const jobs = [createJob('a'), createJob('b')];

            registry.getAllJobs.mockReturnValue(jobs);

            service.stopAllJobs();

            expect(runner.stopAll).toHaveBeenCalledWith(jobs);
        });
    });

    describe('isJobRunning', () => {
        it('should return false when the job is not registered', () => {
            registry.getJob.mockReturnValue(undefined);

            expect(service.isJobRunning('missing')).toBe(false);
        });

        it('should delegate to the runner', () => {
            const job = createJob();

            registry.getJob.mockReturnValue(job);
            runner.isRunning.mockReturnValue(true);

            expect(service.isJobRunning('job')).toBe(true);

            expect(runner.isRunning).toHaveBeenCalledWith(job);
        });

        it('should delegate to the runner for a job instance', () => {
            const job = createJob();

            registry.getJob.mockReturnValue(job);
            runner.isRunning.mockReturnValue(true);

            expect(service.isJobRunning(job)).toBe(true);

            expect(runner.isRunning).toHaveBeenCalledWith(job);
        });
    });
});
