import { SchedulerRunner } from './scheduler-runner';
import { DateJobDefinition, IntervalJobDefinition, JobDefinition, JobType, TimeoutJobDefinition } from '../jobs/job-definition';
import { CronExpression } from '../implementations';

describe('SchedulerRunner', () => {
    let runner: SchedulerRunner;
    let logger: { error: jest.Mock };

    beforeEach(() => {
        jest.useFakeTimers();

        logger = { error: jest.fn() };
        runner = new SchedulerRunner(logger as any);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    const createJob = (name = 'job'): jest.Mocked<JobDefinition> =>
        ({
            name,
            getNextExecutionTime: jest.fn(),
            execute: jest.fn()
        }) as any;

    describe('start', () => {
        it('should schedule a job', () => {
            const job = createJob();
            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            runner.start(job);

            expect(runner.isRunning(job)).toBe(true);
        });

        it('should not schedule a running job twice', () => {
            const job = createJob();
            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            runner.start(job);
            runner.start(job);

            expect(job.getNextExecutionTime).toHaveBeenCalledTimes(1);
        });

        it('should ignore jobs without a next execution time', () => {
            const job = createJob();
            job.getNextExecutionTime.mockReturnValue(undefined);

            runner.start(job);

            expect(runner.isRunning(job)).toBe(false);
        });

        it('should ignore jobs scheduled in the past', () => {
            const job = createJob();
            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() - 1000));

            runner.start(job);

            expect(runner.isRunning(job)).toBe(false);
        });
    });

    describe('stop', () => {
        it('should stop a running job', () => {
            const job = createJob();
            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            runner.start(job);

            expect(runner.isRunning(job)).toBe(true);

            runner.stop(job);

            expect(runner.isRunning(job)).toBe(false);
        });

        it('should not fail when stopping a non-running job', () => {
            const job = createJob();

            expect(() => runner.stop(job)).not.toThrow();
        });
    });

    describe('execution', () => {
        it('should execute the scheduled job', async () => {
            const job = createJob();

            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            job.execute.mockResolvedValue(undefined);

            runner.start(job);

            await jest.advanceTimersByTimeAsync(1000);

            expect(job.execute).toHaveBeenCalledTimes(1);
            expect(runner.isRunning(job)).toBe(false);
        });

        it('should handle execution errors', async () => {
            const job = createJob();

            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            const error = new Error('boom');

            job.execute.mockRejectedValue(error);

            runner.start(job);

            await jest.advanceTimersByTimeAsync(1000);

            expect(logger.error).toHaveBeenCalledWith('Error executing job job', error);
        });

        it('should reschedule enabled jobs', async () => {
            const job = createJob();

            job.getNextExecutionTime.mockReturnValueOnce(new Date(Date.now() + 1000)).mockReturnValueOnce(new Date(Date.now() + 2000));

            job.execute.mockResolvedValue(undefined);

            runner.start(job);

            await jest.advanceTimersByTimeAsync(1000);

            expect(job.getNextExecutionTime).toHaveBeenCalledTimes(2);
            expect(runner.isRunning(job)).toBe(true);
        });

        it('should not reschedule a stopped job', async () => {
            const job = createJob();

            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            job.execute.mockImplementation(async () => {
                runner.stop(job);
            });

            runner.start(job);

            await jest.advanceTimersByTimeAsync(1000);

            expect(job.getNextExecutionTime).toHaveBeenCalledTimes(1);
            expect(runner.isRunning(job)).toBe(false);
        });
    });

    describe('delays longer than the maximum timer delay', () => {
        const MAX_TIMER_DELAY = 2 ** 31 - 1;
        const DAY = 24 * 60 * 60 * 1000;

        it('should wait without executing the job when the delay does not fit in one timer', async () => {
            const job = createJob();
            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 30 * DAY));
            job.execute.mockResolvedValue(undefined);

            runner.start(job);

            await jest.advanceTimersByTimeAsync(MAX_TIMER_DELAY);

            expect(job.execute).not.toHaveBeenCalled();
            expect(job.getNextExecutionTime).toHaveBeenCalledTimes(2);
            expect(runner.isRunning(job)).toBe(true);

            await jest.advanceTimersByTimeAsync(30 * DAY - MAX_TIMER_DELAY);

            expect(job.execute).toHaveBeenCalledTimes(1);
        });

        it('should not wait again when the job is stopped while waiting', async () => {
            const job = createJob();
            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 30 * DAY));

            runner.start(job);
            runner.stop(job);

            await jest.advanceTimersByTimeAsync(30 * DAY);

            expect(job.getNextExecutionTime).toHaveBeenCalledTimes(1);
            expect(job.execute).not.toHaveBeenCalled();
            expect(runner.isRunning(job)).toBe(false);
        });

        it('should run a yearly cron job once a year', async () => {
            jest.setSystemTime(new Date(2026, 0, 2));
            const execute = jest.fn().mockResolvedValue(undefined);
            const job = JobDefinition.fromMetadata({ type: JobType.Cron, name: 'yearly', value: CronExpression.EveryYear, disabled: false } as any, execute);

            runner.start(job);

            await jest.advanceTimersByTimeAsync(new Date(2027, 0, 1).getTime() - Date.now() - 1);
            expect(execute).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1);
            expect(execute).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(new Date(2028, 0, 1).getTime() - Date.now() - 1);
            expect(execute).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(1);
            expect(execute).toHaveBeenCalledTimes(2);
            expect(runner.isRunning(job)).toBe(true);
        });

        it('should run an interval job once per interval', async () => {
            const execute = jest.fn().mockResolvedValue(undefined);
            const job = new IntervalJobDefinition('interval', 30 * DAY, execute);

            runner.start(job);

            await jest.advanceTimersByTimeAsync(30 * DAY - 1);
            expect(execute).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1);
            expect(execute).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(30 * DAY);
            expect(execute).toHaveBeenCalledTimes(2);
        });

        it('should run a date job once at its date', async () => {
            const execute = jest.fn().mockResolvedValue(undefined);
            const job = new DateJobDefinition('date', new Date(Date.now() + 30 * DAY), execute);

            runner.start(job);

            await jest.advanceTimersByTimeAsync(30 * DAY - 1);
            expect(execute).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1);
            expect(execute).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(30 * DAY);
            expect(execute).toHaveBeenCalledTimes(1);
            expect(runner.isRunning(job)).toBe(false);
        });

        it('should run a timeout job once after its timeout', async () => {
            const execute = jest.fn().mockResolvedValue(undefined);
            const job = new TimeoutJobDefinition('timeout', 30 * DAY, execute);

            runner.start(job);

            await jest.advanceTimersByTimeAsync(30 * DAY - 1);
            expect(execute).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1);
            expect(execute).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(30 * DAY);
            expect(execute).toHaveBeenCalledTimes(1);
            expect(runner.isRunning(job)).toBe(false);
        });
    });

    describe('startAll', () => {
        it('should start every job', () => {
            const job1 = createJob('job1');
            const job2 = createJob('job2');

            job1.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            job2.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            runner.startAll([job1, job2]);

            expect(runner.isRunning(job1)).toBe(true);
            expect(runner.isRunning(job2)).toBe(true);
        });
    });

    describe('stopAll', () => {
        it('should stop every job', () => {
            const job1 = createJob('job1');
            const job2 = createJob('job2');

            job1.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            job2.getNextExecutionTime.mockReturnValue(new Date(Date.now() + 1000));

            runner.startAll([job1, job2]);

            runner.stopAll([job1, job2]);

            expect(runner.isRunning(job1)).toBe(false);
            expect(runner.isRunning(job2)).toBe(false);
        });
    });
});
