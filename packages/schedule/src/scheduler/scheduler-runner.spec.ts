import { SchedulerRunner } from './scheduler-runner';
import { DateJobDefinition, IntervalJobDefinition, JobDefinition, JobType, TimeoutJobDefinition } from '../jobs/job-definition';
import { CronExpression } from '../implementations';
import { InMemoryLockStore, Lock, LockStore } from '@axisparkjs/store';
import { SchedulerError } from '../errors';

describe('SchedulerRunner', () => {
    let runner: SchedulerRunner;
    let logger: { error: jest.Mock; warn: jest.Mock; debug: jest.Mock };

    beforeEach(() => {
        jest.useFakeTimers();

        logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
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
            getNextExecutionTimeAfter: jest.fn(),
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
            expect(logger.warn).not.toHaveBeenCalled();
        });

        it('should skip the missed executions of recurring jobs scheduled in the past', () => {
            const job = createJob();
            job.getNextExecutionTime.mockReturnValue(new Date(Date.now() - 1000));
            job.getNextExecutionTimeAfter.mockReturnValue(new Date(Date.now() + 1000));

            runner.start(job);

            expect(job.getNextExecutionTimeAfter).toHaveBeenCalledWith(new Date());
            expect(runner.isRunning(job)).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Job job skipped the executions missed since'));
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

    describe('executions longer than the time to the next one', () => {
        const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

        it('should keep running an interval job after a slow execution', async () => {
            const execute = jest.fn().mockImplementation(() => wait(1500));
            const job = new IntervalJobDefinition('slowInterval', 1000, execute);

            runner.start(job);

            // First execution from 1000 ms to 2500 ms. The execution at 2000 ms is skipped and the next one runs at 3500 ms.
            await jest.advanceTimersByTimeAsync(2500);
            expect(execute).toHaveBeenCalledTimes(1);
            expect(runner.isRunning(job)).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Job slowInterval skipped the executions missed since'));

            await jest.advanceTimersByTimeAsync(1000);
            expect(execute).toHaveBeenCalledTimes(2);

            runner.stop(job);
        });

        it('should keep running a cron job after a slow execution', async () => {
            jest.setSystemTime(new Date(2026, 0, 1, 12, 0, 30));
            const execute = jest.fn().mockImplementation(() => wait(70_000));
            const job = JobDefinition.fromMetadata(
                { type: JobType.Cron, name: 'slowCron', value: CronExpression.EveryMinute, disabled: false } as any,
                execute
            );

            runner.start(job);

            // First execution from 12:01:00 to 12:02:10. The 12:02:00 slot is skipped and the next one runs at 12:03:00.
            await jest.advanceTimersByTimeAsync(30_000 + 70_000);
            expect(execute).toHaveBeenCalledTimes(1);
            expect(runner.isRunning(job)).toBe(true);
            expect(job.getNextExecutionTime()).toEqual(new Date(2026, 0, 1, 12, 2, 0));
            expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Job slowCron skipped the executions missed since'));

            await jest.advanceTimersByTimeAsync(49_999);
            expect(execute).toHaveBeenCalledTimes(1);

            await jest.advanceTimersByTimeAsync(1);
            expect(execute).toHaveBeenCalledTimes(2);

            runner.stop(job);
        });

        it('should never overlap two executions of the same job', async () => {
            let running = 0;
            let maxRunning = 0;
            const execute = jest.fn().mockImplementation(async () => {
                running++;
                maxRunning = Math.max(maxRunning, running);
                await wait(2500);
                running--;
            });
            const job = new IntervalJobDefinition('overlap', 1000, execute);

            runner.start(job);
            await jest.advanceTimersByTimeAsync(20_000);
            runner.stop(job);

            expect(execute.mock.calls.length).toBeGreaterThan(1);
            expect(maxRunning).toBe(1);
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

    describe('exclusive jobs', () => {
        const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
        let store: InMemoryLockStore;
        let other: SchedulerRunner;

        beforeEach(() => {
            jest.setSystemTime(new Date(2026, 0, 1, 12, 0, 30));
            store = new InMemoryLockStore();
            runner.useLockStore(store);
            other = new SchedulerRunner(logger as any);
            other.useLockStore(store);
        });

        const cronJob = (execute: jest.Mock, exclusive: any = true) =>
            JobDefinition.fromMetadata({ type: JobType.Cron, name: 'cron', value: CronExpression.EveryMinute, disabled: false, exclusive } as any, execute);

        it('should report an error when no lock store is registered', async () => {
            const execute = jest.fn().mockResolvedValue(undefined);
            const unconfigured = new SchedulerRunner(logger as any);
            unconfigured.start(cronJob(execute));

            await jest.advanceTimersByTimeAsync(30_000);

            expect(execute).not.toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith('Error executing job cron', expect.any(SchedulerError));
            unconfigured.stopAll([]);
        });

        it('should run each occurrence of a cron job on only one instance', async () => {
            const first = jest.fn().mockResolvedValue(undefined);
            const second = jest.fn().mockResolvedValue(undefined);
            const firstJob = cronJob(first);
            const secondJob = cronJob(second);

            runner.start(firstJob);
            other.start(secondJob);
            await jest.advanceTimersByTimeAsync(30_000 + 60_000 * 2);

            expect(first.mock.calls.length + second.mock.calls.length).toBe(3);
            expect(logger.debug).toHaveBeenCalledWith('Job cron skipped because another instance holds its lock');
            expect(logger.warn).not.toHaveBeenCalled();
            expect(runner.isRunning(firstJob)).toBe(true);
            expect(other.isRunning(secondJob)).toBe(true);

            runner.stop(firstJob);
            other.stop(secondJob);
        });

        it('should keep the lock of an occurrence until the next occurrence', async () => {
            const acquire = jest.spyOn(store, 'acquire');
            const job = cronJob(jest.fn().mockResolvedValue(undefined));

            runner.start(job);
            await jest.advanceTimersByTimeAsync(30_000);

            expect(acquire).toHaveBeenCalledWith(`schedule:cron:${new Date(2026, 0, 1, 12, 1).toISOString()}`, 60_000);
            await expect(store.acquire(`schedule:cron:${new Date(2026, 0, 1, 12, 1).toISOString()}`, 1)).resolves.toBeUndefined();
            runner.stop(job);
        });

        it('should use the configured time to live of the lock', async () => {
            const acquire = jest.spyOn(store, 'acquire');
            const job = cronJob(jest.fn().mockResolvedValue(undefined), { ttl: 5_000 });

            runner.start(job);
            await jest.advanceTimersByTimeAsync(30_000);

            expect(acquire).toHaveBeenCalledWith(expect.any(String), 5_000);
            runner.stop(job);
        });

        it('should use a default time to live for the jobs that are not recurring', async () => {
            const acquire = jest.spyOn(store, 'acquire');
            const job = new DateJobDefinition('date', new Date(Date.now() + 1_000), jest.fn().mockResolvedValue(undefined)).setExclusive(true);

            runner.start(job);
            await jest.advanceTimersByTimeAsync(1_000);

            expect(acquire).toHaveBeenCalledWith(expect.stringMatching(/^schedule:date:/), 60_000);
        });

        it('should run an interval job once per interval on instances started at different times', async () => {
            const first = jest.fn().mockResolvedValue(undefined);
            const second = jest.fn().mockResolvedValue(undefined);
            jest.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 100));
            const firstJob = new IntervalJobDefinition('interval', 1_000, first).setExclusive(true);
            runner.start(firstJob);
            await jest.advanceTimersByTimeAsync(400);
            const secondJob = new IntervalJobDefinition('interval', 1_000, second).setExclusive(true);
            other.start(secondJob);

            await jest.advanceTimersByTimeAsync(10_000);

            expect(first.mock.calls.length + second.mock.calls.length).toBe(10);
            runner.stop(firstJob);
            other.stop(secondJob);
        });

        it('should skip the occurrence when the lock cannot be acquired', async () => {
            const error = new Error('Redis is down');
            const failing: LockStore = { acquire: jest.fn().mockRejectedValue(error) };
            runner.useLockStore(failing);
            const execute = jest.fn().mockResolvedValue(undefined);
            const job = cronJob(execute);

            runner.start(job);
            await jest.advanceTimersByTimeAsync(30_000);

            expect(execute).not.toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith('Job cron skipped because its lock could not be acquired', error);
            expect(job.getNextExecutionTime()).toEqual(new Date(2026, 0, 1, 12, 2));
            expect(runner.isRunning(job)).toBe(true);
            runner.stop(job);
        });

        describe('no-overlap', () => {
            const noOverlap = (execute: jest.Mock, ttl?: number) => new IntervalJobDefinition('slow', 1_000, execute).setExclusive({ mode: 'no-overlap', ttl });

            it('should not run on two instances at the same time and release the lock when it ends', async () => {
                let running = 0;
                let maxRunning = 0;
                const execute = jest.fn().mockImplementation(async () => {
                    running++;
                    maxRunning = Math.max(maxRunning, running);
                    await wait(1_500);
                    running--;
                });
                const firstJob = noOverlap(execute);
                const secondJob = noOverlap(execute);

                runner.start(firstJob);
                other.start(secondJob);
                await jest.advanceTimersByTimeAsync(10_000);
                runner.stop(firstJob);
                other.stop(secondJob);
                await jest.advanceTimersByTimeAsync(2_000);

                expect(execute.mock.calls.length).toBeGreaterThan(1);
                expect(maxRunning).toBe(1);
                await expect(store.acquire('schedule:slow', 1)).resolves.toBeDefined();
            });

            it('should extend the lock every half of its time to live while the job runs', async () => {
                const lock = { key: 'schedule:slow', token: 't', extend: jest.fn().mockResolvedValue(true), release: jest.fn().mockResolvedValue(true) };
                const lockStore: LockStore = { acquire: jest.fn().mockResolvedValue(lock) };
                runner.useLockStore(lockStore);
                const job = noOverlap(
                    jest.fn().mockImplementation(() => wait(2_500)),
                    1_000
                );

                runner.start(job);
                await jest.advanceTimersByTimeAsync(1_000 + 2_500);
                runner.stop(job);

                expect(lockStore.acquire).toHaveBeenCalledWith('schedule:slow', 1_000);
                // The job runs 2500 ms: the lock is extended at 500, 1000, 1500 and 2000 ms, and released when the job ends.
                expect(lock.extend).toHaveBeenCalledTimes(4);
                expect(lock.extend).toHaveBeenCalledWith(1_000);
                expect(lock.release).toHaveBeenCalledTimes(1);
            });

            it('should use a default time to live of 30 seconds', async () => {
                const acquire = jest.spyOn(store, 'acquire');
                const job = noOverlap(jest.fn().mockResolvedValue(undefined));

                runner.start(job);
                await jest.advanceTimersByTimeAsync(1_000);
                runner.stop(job);

                expect(acquire).toHaveBeenCalledWith('schedule:slow', 30_000);
            });

            it('should report the errors of the lock without stopping the job', async () => {
                const lock: Lock = {
                    key: 'schedule:slow',
                    token: 't',
                    extend: jest.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('extend')),
                    release: jest.fn().mockRejectedValue(new Error('release'))
                };
                runner.useLockStore({ acquire: jest.fn().mockResolvedValue(lock) });
                const execute = jest.fn().mockImplementation(() => wait(1_200));
                const job = noOverlap(execute, 1_000);

                runner.start(job);
                await jest.advanceTimersByTimeAsync(1_000 + 1_200);
                runner.stop(job);

                expect(execute).toHaveBeenCalledTimes(1);
                expect(logger.warn).toHaveBeenCalledWith('Job slow lost its lock while running');
                expect(logger.error).toHaveBeenCalledWith('Job slow could not extend its lock', expect.any(Error));
                expect(logger.error).toHaveBeenCalledWith('Job slow could not release its lock', expect.any(Error));
            });
        });
    });
});
