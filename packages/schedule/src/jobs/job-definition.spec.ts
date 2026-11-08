import { ClassType } from '@axisparkjs/common';
import { CronJobDefinition, DateJobDefinition, IntervalJobDefinition, JobDefinition, JobType, TimeoutJobDefinition } from './job-definition';

import { CronJobTrigger, DateJobTrigger, IntervalJobTrigger, TimeoutJobTrigger } from './job-trigger';

jest.mock('./job-trigger', () => ({
    CronJobTrigger: jest.fn(),
    IntervalJobTrigger: jest.fn(),
    DateJobTrigger: jest.fn(),
    TimeoutJobTrigger: jest.fn()
}));

describe('JobDefinition.fromMetadata', () => {
    const execute = jest.fn().mockResolvedValue(undefined);

    it.each([
        [JobType.Cron, '* * * * *', CronJobDefinition],
        [JobType.Interval, 1000, IntervalJobDefinition],
        [JobType.Date, new Date(Date.now() + 10000), DateJobDefinition],
        [JobType.Timeout, 5000, TimeoutJobDefinition]
    ])('should create a %s job', (type, value, expected) => {
        const job = JobDefinition.fromMetadata({ name: 'job', disabled: false, value, type, propertyKey: 'execute', target: {} as ClassType }, execute);

        expect(job).toBeInstanceOf(expected);
    });
});

describe('Exclusive jobs', () => {
    const create = () => new IntervalJobDefinition('job', 1000, jest.fn());

    it('should run on every instance by default', () => {
        expect(create().exclusive).toBeUndefined();
    });

    it.each([
        [true, { mode: 'once-per-occurrence' }],
        [{}, { mode: 'once-per-occurrence', ttl: undefined }],
        [{ ttl: 5_000 }, { mode: 'once-per-occurrence', ttl: 5_000 }],
        [{ mode: 'no-overlap' as const }, { mode: 'no-overlap', ttl: undefined }]
    ])('should normalize the exclusive option %p', (exclusive, expected) => {
        expect(create().setExclusive(exclusive).exclusive).toEqual(expected);
    });

    it('should stop being exclusive', () => {
        expect(create().setExclusive(true).setExclusive(false).exclusive).toBeUndefined();
    });

    it('should create exclusive jobs from metadata', () => {
        const job = JobDefinition.fromMetadata(
            {
                name: 'job',
                disabled: false,
                value: 1000,
                type: JobType.Interval,
                exclusive: { mode: 'no-overlap' },
                propertyKey: 'execute',
                target: {} as ClassType
            },
            jest.fn()
        );

        expect(job.exclusive).toEqual({ mode: 'no-overlap', ttl: undefined });
    });
});

describe('CronJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        (CronJobTrigger as jest.Mock).mockImplementation(() => ({
            getNextExecutionTime: jest.fn()
        }));
    });

    it('should create a cron trigger', () => {
        const execute = jest.fn();

        const job = new CronJobDefinition('cron', '* * * * *', execute, true);

        expect(job.type).toBe(JobType.Cron);
        expect(CronJobTrigger).toHaveBeenCalledWith('* * * * *', undefined);
    });

    it('should update the cron expression', () => {
        const execute = jest.fn();

        const job = new CronJobDefinition('cron', '* * * * *', execute, true);

        (CronJobTrigger as jest.Mock).mockClear();

        job.updateCronExpression('0 * * * *', 'UTC');

        expect(CronJobTrigger).toHaveBeenCalledWith('0 * * * *', 'UTC');
    });
});

describe('IntervalJob', () => {
    beforeEach(() => {
        (IntervalJobTrigger as jest.Mock).mockImplementation(() => ({
            getNextExecutionTime: jest.fn()
        }));
    });

    it('should update the interval', () => {
        const job = new IntervalJobDefinition('interval', 1000, jest.fn(), true);

        (IntervalJobTrigger as jest.Mock).mockClear();

        job.updateInterval(5000);

        expect(IntervalJobTrigger).toHaveBeenCalledWith(5000);
    });
});

describe('DateJob', () => {
    beforeEach(() => {
        (DateJobTrigger as jest.Mock).mockImplementation(() => ({
            getNextExecutionTime: jest.fn()
        }));
    });

    it('should update the date', () => {
        const date = new Date(Date.now() + 10000);

        const job = new DateJobDefinition('date', date, jest.fn(), true);

        const newDate = new Date(Date.now() + 20000);

        (DateJobTrigger as jest.Mock).mockClear();

        job.updateDate(newDate);

        expect(DateJobTrigger).toHaveBeenCalledWith(newDate);
    });
});

describe('TimeoutJob', () => {
    beforeEach(() => {
        (TimeoutJobTrigger as jest.Mock).mockImplementation(() => ({
            getNextExecutionTime: jest.fn()
        }));
    });

    it('should update the timeout', () => {
        const job = new TimeoutJobDefinition('timeout', 1000, jest.fn(), true);

        (TimeoutJobTrigger as jest.Mock).mockClear();

        job.updateTimeout(5000);

        expect(TimeoutJobTrigger).toHaveBeenCalledWith(5000);
    });
});

describe('Job execution', () => {
    beforeEach(() => {
        (IntervalJobTrigger as jest.Mock).mockImplementation(() => ({
            getNextExecutionTime: jest.fn().mockReturnValue('next')
        }));
    });

    it('should execute the job', async () => {
        const execute = jest.fn().mockResolvedValue(undefined);

        const job = new IntervalJobDefinition('job', 1000, execute, true);

        expect(job.getLastExecutionTime()).toBeUndefined();

        await job.execute();

        expect(execute).toHaveBeenCalledTimes(1);
        expect(job.getLastExecutionTime()).toBeInstanceOf(Date);
    });

    it('should delegate next execution time to the trigger', () => {
        const trigger = {
            getNextExecutionTime: jest.fn().mockReturnValue('next')
        };

        (IntervalJobTrigger as jest.Mock).mockImplementation(() => trigger);

        const job = new IntervalJobDefinition('job', 1000, jest.fn(), true);

        expect(job.getNextExecutionTime()).toBe('next');

        expect(trigger.getNextExecutionTime).toHaveBeenCalledWith(undefined);
    });

    it('should pass the last execution time to the trigger', async () => {
        const trigger = {
            getNextExecutionTime: jest.fn()
        };

        (IntervalJobTrigger as jest.Mock).mockImplementation(() => trigger);

        const job = new IntervalJobDefinition('job', 1000, jest.fn().mockResolvedValue(undefined), true);

        await job.execute();

        const lastExecution = job.getLastExecutionTime();

        job.getNextExecutionTime();

        expect(trigger.getNextExecutionTime).toHaveBeenCalledWith(lastExecution);
    });

    it('should skip an occurrence without executing the job and calculate the next one from the skip', () => {
        const trigger = { getNextExecutionTime: jest.fn() };
        (IntervalJobTrigger as jest.Mock).mockImplementation(() => trigger);
        const execute = jest.fn();
        const job = new IntervalJobDefinition('job', 1000, execute, true);

        job.skipExecution();
        job.getNextExecutionTime();

        expect(execute).not.toHaveBeenCalled();
        expect(job.getLastExecutionTime()).toBeUndefined();
        expect(trigger.getNextExecutionTime).toHaveBeenCalledWith(expect.any(Date));
    });

    it('should delegate the occurrences to the trigger', () => {
        const trigger = { getOccurrenceKey: jest.fn().mockReturnValue('key'), getOccurrenceInterval: jest.fn().mockReturnValue(1000) };
        (IntervalJobTrigger as jest.Mock).mockImplementation(() => trigger);
        const job = new IntervalJobDefinition('job', 1000, jest.fn(), true);
        const date = new Date();

        expect(job.getOccurrenceKey(date)).toBe('key');
        expect(job.getOccurrenceInterval(date)).toBe(1000);
        expect(trigger.getOccurrenceKey).toHaveBeenCalledWith(date);
        expect(trigger.getOccurrenceInterval).toHaveBeenCalledWith(date);
    });

    it('should delegate the next execution time after a date to the trigger', () => {
        const trigger = {
            getNextExecutionTimeAfter: jest.fn().mockReturnValue('next')
        };

        (IntervalJobTrigger as jest.Mock).mockImplementation(() => trigger);

        const job = new IntervalJobDefinition('job', 1000, jest.fn(), true);
        const date = new Date();

        expect(job.getNextExecutionTimeAfter(date)).toBe('next');
        expect(trigger.getNextExecutionTimeAfter).toHaveBeenCalledWith(date);
    });
});
