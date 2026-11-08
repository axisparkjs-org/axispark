import { CronTime, validateCronExpression } from 'cron';
import { JobError } from '../errors/job-error';

/**
 * An abstract class representing a job trigger.
 */
export abstract class JobTrigger {
    public readonly createdAt: Date;

    constructor() {
        this.createdAt = new Date();
    }

    /**
     * Gets the next execution time for the job.
     * @param lastExecutionTime The time of the last execution.
     * @returns The next execution time, or undefined if the job has no more executions.
     */
    abstract getNextExecutionTime(lastExecutionTime?: Date): Date | undefined;

    /**
     * Gets the first execution time of a recurring job after a date.
     * It is used to skip the executions that were missed, for example while the previous execution was running.
     * @param date The date after which the execution time is calculated.
     * @returns The first execution time after the date, or undefined if the job is not recurring.
     */
    getNextExecutionTimeAfter(_date: Date): Date | undefined {
        return undefined;
    }

    /**
     * Identifies an occurrence of the job, so every instance of the application that runs the same occurrence uses the same lock.
     * @param scheduledAt The scheduled time of the occurrence.
     * @returns The scheduled time in ISO format, which is the same in every instance for date and cron jobs.
     */
    getOccurrenceKey(scheduledAt: Date): string {
        return scheduledAt.toISOString();
    }

    /**
     * Gets the time between an occurrence and the next one, used as the default time to live of the lock of an occurrence.
     * @param _scheduledAt The scheduled time of the occurrence.
     * @returns The milliseconds until the next occurrence, or undefined if the job is not recurring.
     */
    getOccurrenceInterval(_scheduledAt: Date): number | undefined {
        return undefined;
    }
}

/**
 * A class representing a cron-based job trigger.
 */
export class CronJobTrigger extends JobTrigger {
    private readonly cronTime: CronTime;

    constructor(
        public readonly cronExpression: string,
        timeZone?: string
    ) {
        const valid = validateCronExpression(cronExpression);
        if (!valid) throw new JobError(`Invalid cron expression: ${cronExpression}`);

        super();
        this.cronTime = new CronTime(cronExpression, timeZone);
    }

    getNextExecutionTime(lastExecutionTime?: Date): Date | undefined {
        const baseTime = lastExecutionTime || this.createdAt;

        try {
            return this.cronTime.getNextDateFrom(baseTime).toJSDate();
        } catch (error) {
            throw new JobError(`Failed to calculate next execution time for cron expression: ${this.cronExpression}`);
        }
    }

    override getNextExecutionTimeAfter(date: Date): Date | undefined {
        return this.getNextExecutionTime(date);
    }

    override getOccurrenceInterval(scheduledAt: Date): number | undefined {
        return (this.getNextExecutionTime(scheduledAt) as Date).getTime() - scheduledAt.getTime();
    }
}

/**
 * A class representing an interval-based job trigger.
 */
export class IntervalJobTrigger extends JobTrigger {
    constructor(public readonly interval: number) {
        if (interval <= 0) throw new JobError(`Interval must be greater than 0, got: ${interval}`);
        super();
    }

    getNextExecutionTime(lastExecutionTime?: Date): Date | undefined {
        if (!lastExecutionTime) return new Date(this.createdAt.getTime() + this.interval);

        return new Date(lastExecutionTime.getTime() + this.interval);
    }

    override getNextExecutionTimeAfter(date: Date): Date | undefined {
        return new Date(date.getTime() + this.interval);
    }

    /**
     * Identifies the interval window of the occurrence, counted from the Unix epoch. The instances of the application start at
     * different times, so their scheduled times differ, but each instance runs the job once per window.
     */
    override getOccurrenceKey(scheduledAt: Date): string {
        return String(Math.floor(scheduledAt.getTime() / this.interval));
    }

    override getOccurrenceInterval(): number | undefined {
        return this.interval;
    }
}

/**
 * A class representing a date-based job trigger.
 */
export class DateJobTrigger extends JobTrigger {
    constructor(public readonly date: Date) {
        if (date.getTime() <= Date.now()) throw new JobError(`Date must be in the future, got: ${date}`);
        super();
    }

    getNextExecutionTime(): Date | undefined {
        if (this.date.getTime() <= Date.now()) return undefined;
        return this.date;
    }
}

/**
 * A class representing a timeout-based job trigger.
 */
export class TimeoutJobTrigger extends JobTrigger {
    constructor(public readonly timeout: number) {
        if (timeout <= 0) throw new JobError(`Timeout must be greater than 0, got: ${timeout}`);
        super();
    }

    getNextExecutionTime(): Date | undefined {
        return new Date(this.createdAt.getTime() + this.timeout);
    }

    /** The job runs once per process, so every instance shares the same lock during its time to live. */
    override getOccurrenceKey(): string {
        return 'timeout';
    }
}
