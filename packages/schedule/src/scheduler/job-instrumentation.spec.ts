import { InMemoryLockStore } from '@axisparkjs/store';
import { CronExpression } from '../implementations';
import { JobDefinition, JobType } from '../jobs/job-definition';
import { JobInstrumentation } from './job-instrumentation';
import { SchedulerRunner } from './scheduler-runner';

describe('SchedulerRunner instrumentation', () => {
    let logger: { error: jest.Mock; warn: jest.Mock; debug: jest.Mock };
    const job = (execute: jest.Mock, exclusive?: unknown) =>
        JobDefinition.fromMetadata({ type: JobType.Cron, name: 'report', value: CronExpression.EveryMinute, disabled: false, exclusive } as any, execute);

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(2026, 0, 1, 12, 0, 30));
        logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    });

    afterEach(() => {
        SchedulerRunner.registerInstrumentation();
        jest.useRealTimers();
    });

    it('observes an executed job, running it inside the observer', async () => {
        const calls: string[] = [];
        const end = jest.fn();
        const instrumentation: JobInstrumentation = {
            start: jest.fn().mockReturnValue({
                run: async (execution: () => Promise<unknown>) => {
                    calls.push('run');
                    return await execution();
                },
                end
            })
        };
        SchedulerRunner.registerInstrumentation(instrumentation);
        const runner = new SchedulerRunner(logger as any);
        const definition = job(jest.fn().mockImplementation(async () => calls.push('job')));

        runner.start(definition);
        await jest.advanceTimersByTimeAsync(30_000);
        runner.stop(definition);

        expect(instrumentation.start).toHaveBeenCalledWith(definition, new Date(2026, 0, 1, 12, 1));
        expect(calls).toEqual(['run', 'job']);
        expect(end).toHaveBeenCalledWith('executed', undefined);
    });

    it('observes a failed job with its error, with an end function', async () => {
        const end = jest.fn();
        SchedulerRunner.registerInstrumentation({ start: () => end });
        const runner = new SchedulerRunner(logger as any);
        const error = new Error('boom');
        const definition = job(jest.fn().mockRejectedValue(error));

        runner.start(definition);
        await jest.advanceTimersByTimeAsync(30_000);
        runner.stop(definition);

        expect(end).toHaveBeenCalledWith('failed', error);
        expect(logger.error).toHaveBeenCalledWith('Error executing job report', error);
    });

    it('observes the occurrences skipped by an exclusive job', async () => {
        const outcomes: string[] = [];
        SchedulerRunner.registerInstrumentation({ start: () => (outcome) => outcomes.push(outcome) });
        const store = new InMemoryLockStore();
        const [first, second] = [new SchedulerRunner(logger as any), new SchedulerRunner(logger as any)];
        first.useLockStore(store);
        second.useLockStore(store);
        const [firstJob, secondJob] = [job(jest.fn().mockResolvedValue(undefined), true), job(jest.fn().mockResolvedValue(undefined), true)];

        first.start(firstJob);
        second.start(secondJob);
        await jest.advanceTimersByTimeAsync(30_000);
        first.stop(firstJob);
        second.stop(secondJob);

        expect(outcomes.sort()).toEqual(['executed', 'skipped']);
    });

    it('runs the jobs without instrumentation', async () => {
        const execute = jest.fn().mockResolvedValue(undefined);
        const runner = new SchedulerRunner(logger as any);
        const definition = job(execute);

        runner.start(definition);
        await jest.advanceTimersByTimeAsync(30_000);
        runner.stop(definition);

        expect(execute).toHaveBeenCalledTimes(1);
    });
});
