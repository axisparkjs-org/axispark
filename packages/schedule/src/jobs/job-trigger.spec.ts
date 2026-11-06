import { CronTime, validateCronExpression } from 'cron';
import { JobError } from '../errors/job-error';
import { CronJobTrigger, DateJobTrigger, IntervalJobTrigger, TimeoutJobTrigger } from './job-trigger';
import { CronExpression } from '../implementations';

jest.mock('cron', () => ({
    CronTime: jest.fn(),
    validateCronExpression: jest.fn()
}));

describe('CronJobTrigger', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should throw for an invalid cron expression', () => {
        (validateCronExpression as jest.Mock).mockReturnValue(false);

        expect(() => new CronJobTrigger('invalid')).toThrow(JobError);
        expect(() => new CronJobTrigger('invalid')).toThrow('Invalid cron expression: invalid');
    });

    it('should create a CronTime for a valid expression', () => {
        (validateCronExpression as jest.Mock).mockReturnValue(true);

        const cronTime = {
            getNextDateFrom: jest.fn()
        };

        (CronTime as unknown as jest.Mock).mockImplementation(() => cronTime);

        const trigger = new CronJobTrigger(CronExpression.EverySecond, 'UTC');

        expect(trigger.cronExpression).toBe('* * * * * *');
        expect(CronTime).toHaveBeenCalledWith('* * * * * *', 'UTC');
    });

    it('should calculate the next execution time', () => {
        (validateCronExpression as jest.Mock).mockReturnValue(true);

        const next = new Date('2030-01-01T00:01:00Z');

        const cronTime = {
            getNextDateFrom: jest.fn().mockReturnValue({
                toJSDate: () => next
            })
        };

        (CronTime as unknown as jest.Mock).mockImplementation(() => cronTime);

        const trigger = new CronJobTrigger('* * * * *');

        const result = trigger.getNextExecutionTime();

        expect(result).toBe(next);
        expect(cronTime.getNextDateFrom).toHaveBeenCalledWith(trigger.createdAt);
    });

    it('should use the provided last execution time', () => {
        (validateCronExpression as jest.Mock).mockReturnValue(true);

        const lastExecution = new Date('2030-01-01T00:00:00Z');

        const cronTime = {
            getNextDateFrom: jest.fn().mockReturnValue({
                toJSDate: () => lastExecution
            })
        };

        (CronTime as unknown as jest.Mock).mockImplementation(() => cronTime);

        const trigger = new CronJobTrigger('* * * * *');

        trigger.getNextExecutionTime(lastExecution);

        expect(cronTime.getNextDateFrom).toHaveBeenCalledWith(lastExecution);
    });

    it('should wrap CronTime errors in JobError', () => {
        (validateCronExpression as jest.Mock).mockReturnValue(true);

        const cronTime = {
            getNextDateFrom: jest.fn().mockImplementation(() => {
                throw new Error();
            })
        };

        (CronTime as unknown as jest.Mock).mockImplementation(() => cronTime);

        const trigger = new CronJobTrigger('* * * * *');

        expect(() => trigger.getNextExecutionTime()).toThrow(JobError);
    });
});

describe('CronJobTrigger.getNextExecutionTimeAfter', () => {
    it('should calculate the next slot after the date', () => {
        (validateCronExpression as jest.Mock).mockReturnValue(true);

        const next = new Date('2030-01-01T00:02:00Z');
        const cronTime = {
            getNextDateFrom: jest.fn().mockReturnValue({ toJSDate: () => next })
        };
        (CronTime as unknown as jest.Mock).mockImplementation(() => cronTime);

        const trigger = new CronJobTrigger('* * * * *');
        const date = new Date('2030-01-01T00:01:10Z');

        expect(trigger.getNextExecutionTimeAfter(date)).toBe(next);
        expect(cronTime.getNextDateFrom).toHaveBeenCalledWith(date);
    });
});

describe('IntervalJobTrigger', () => {
    it('should throw when interval is not positive', () => {
        expect(() => new IntervalJobTrigger(0)).toThrow(JobError);
        expect(() => new IntervalJobTrigger(-1)).toThrow(JobError);
    });

    it('should calculate from createdAt when there is no previous execution', () => {
        const trigger = new IntervalJobTrigger(1000);

        const result = trigger.getNextExecutionTime();

        expect(result?.getTime()).toBe(trigger.createdAt.getTime() + 1000);
    });

    it('should calculate from the last execution', () => {
        const trigger = new IntervalJobTrigger(1000);
        const last = new Date('2030-01-01T00:00:00Z');

        const result = trigger.getNextExecutionTime(last);

        expect(result).toEqual(new Date(last.getTime() + 1000));
    });

    it('should calculate the next execution after a date', () => {
        const trigger = new IntervalJobTrigger(1000);
        const date = new Date('2030-01-01T00:00:05Z');

        expect(trigger.getNextExecutionTimeAfter(date)).toEqual(new Date(date.getTime() + 1000));
    });
});

describe('DateJobTrigger', () => {
    it('should throw when the date is in the past', () => {
        expect(() => new DateJobTrigger(new Date(Date.now() - 1000))).toThrow(JobError);
    });

    it('should return the configured date', () => {
        const date = new Date(Date.now() + 60_000);

        const trigger = new DateJobTrigger(date);

        expect(trigger.getNextExecutionTime()).toBe(date);
    });

    it('should return undefined when the date has already passed', () => {
        const date = new Date(Date.now() + 100);

        const trigger = new DateJobTrigger(date);

        jest.useFakeTimers();
        jest.setSystemTime(new Date(Date.now() + 1000));

        expect(trigger.getNextExecutionTime()).toBeUndefined();

        jest.useRealTimers();
    });

    it('should not calculate an execution after a date', () => {
        const trigger = new DateJobTrigger(new Date(Date.now() + 60_000));

        expect(trigger.getNextExecutionTimeAfter(new Date())).toBeUndefined();
    });
});

describe('TimeoutJobTrigger', () => {
    it('should throw when timeout is not positive', () => {
        expect(() => new TimeoutJobTrigger(0)).toThrow(JobError);
        expect(() => new TimeoutJobTrigger(-100)).toThrow(JobError);
    });

    it('should calculate the execution time', () => {
        const trigger = new TimeoutJobTrigger(5000);

        const result = trigger.getNextExecutionTime();

        expect(result).toEqual(new Date(trigger.createdAt.getTime() + 5000));
    });

    it('should not calculate an execution after a date', () => {
        const trigger = new TimeoutJobTrigger(5000);

        expect(trigger.getNextExecutionTimeAfter(new Date())).toBeUndefined();
    });
});
