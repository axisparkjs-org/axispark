import { Executable } from '@axisparkjs/common';
import { CronJobTrigger, DateJobTrigger, IntervalJobTrigger, JobTrigger, TimeoutJobTrigger } from './job-trigger';
import { JobExclusiveMode, JobExclusiveOptions, JobMetadata } from '../metadata';

/**
 * An enumeration of job types.
 */
export enum JobType {
    Cron = 'cron',
    Interval = 'interval',
    Date = 'date',
    Timeout = 'timeout'
}

/**
 * The function of a job. It receives an `AbortSignal` that is aborted when the job is stopped, for example when the application stops,
 * so a long job can end early between its steps. Jobs that do not need it can ignore it.
 */
export type JobFunction = (signal: AbortSignal) => Promise<void>;

/** The normalized options of an exclusive job. */
export interface JobExclusivity {
    readonly mode: JobExclusiveMode;
    readonly ttl?: number;
}

/**
 * An abstract class representing a job definition.
 */
export abstract class JobDefinition implements Executable {
    abstract readonly type: JobType;
    protected abstract trigger: JobTrigger;
    protected lastExecutionTime?: Date;
    /** The time of the last occurrence, executed by this instance or skipped because another instance ran it. */
    protected lastOccurrenceTime?: Date;
    private exclusivity?: JobExclusivity;

    public constructor(
        public readonly name: string,
        private readonly job: JobFunction,
        public readonly initiallyDisabled = false
    ) {}

    protected changeTrigger(trigger: JobTrigger): void {
        this.trigger = trigger;
    }

    /**
     * Gets the last execution time of the job.
     * @returns The last execution time, or undefined if the job has not been executed yet.
     */
    public getLastExecutionTime(): Date | undefined {
        return this.lastExecutionTime;
    }

    /**
     * Gets the next execution time of the job.
     * @returns The next execution time, or undefined if the job has no more executions.
     */
    public getNextExecutionTime(): Date | undefined {
        return this.trigger.getNextExecutionTime(this.lastOccurrenceTime);
    }

    /**
     * Gets the first execution time of the job after a date, skipping the executions scheduled before it.
     * @param date The date after which the execution time is calculated.
     * @returns The first execution time after the date, or undefined if the job is not recurring (date and timeout jobs).
     */
    public getNextExecutionTimeAfter(date: Date): Date | undefined {
        return this.trigger.getNextExecutionTimeAfter(date);
    }

    /**
     * Executes the job.
     * @param signal The signal passed to the job function, aborted when the job is stopped. Defaults to a signal that is never aborted.
     * @returns A promise resolving when the job has been executed.
     */
    public async execute(signal: AbortSignal = new AbortController().signal): Promise<void> {
        this.lastExecutionTime = new Date();
        this.lastOccurrenceTime = this.lastExecutionTime;
        await this.job(signal);
    }

    /**
     * Skips the current occurrence without executing the job, for example because another instance holds its lock.
     * The next execution time is calculated from now, as if the job had been executed.
     */
    public skipExecution(): void {
        this.lastOccurrenceTime = new Date();
    }

    /**
     * The options of the job when it runs on only one instance of the application, or undefined when it runs on every instance.
     */
    public get exclusive(): JobExclusivity | undefined {
        return this.exclusivity;
    }

    /**
     * Sets whether the job runs on only one instance of the application.
     * @param exclusive `true` for the `once-per-occurrence` mode, the options of the exclusive job, or `false` to run it on every instance.
     * @returns The job definition.
     */
    public setExclusive(exclusive?: boolean | JobExclusiveOptions): this {
        if (!exclusive) this.exclusivity = undefined;
        else if (exclusive === true) this.exclusivity = { mode: 'once-per-occurrence' };
        else this.exclusivity = { mode: exclusive.mode ?? 'once-per-occurrence', ttl: exclusive.ttl };
        return this;
    }

    /**
     * Identifies an occurrence of the job, so every instance that runs the same occurrence uses the same lock.
     * @param scheduledAt The scheduled time of the occurrence.
     * @returns The key of the occurrence.
     */
    public getOccurrenceKey(scheduledAt: Date): string {
        return this.trigger.getOccurrenceKey(scheduledAt);
    }

    /**
     * Gets the time between an occurrence and the next one.
     * @param scheduledAt The scheduled time of the occurrence.
     * @returns The milliseconds until the next occurrence, or undefined if the job is not recurring.
     */
    public getOccurrenceInterval(scheduledAt: Date): number | undefined {
        return this.trigger.getOccurrenceInterval(scheduledAt);
    }

    /**
     * Creates a job definition from metadata.
     * @param metadata The metadata for the job.
     * @param execute The function to execute when the job runs.
     * @returns The created job definition.
     */
    public static fromMetadata(metadata: JobMetadata, execute: JobFunction): JobDefinition {
        return JobDefinition.create(metadata, execute).setExclusive(metadata.exclusive);
    }

    private static create(metadata: JobMetadata, execute: JobFunction): JobDefinition {
        switch (metadata.type) {
            case JobType.Cron:
                return new CronJobDefinition(metadata.name, metadata.value as string, execute, metadata.disabled, metadata.timeZone);
            case JobType.Interval:
                return new IntervalJobDefinition(metadata.name, metadata.value as number, execute, metadata.disabled);
            case JobType.Date:
                return new DateJobDefinition(metadata.name, metadata.value as Date, execute, metadata.disabled);
            case JobType.Timeout:
                return new TimeoutJobDefinition(metadata.name, metadata.value as number, execute, metadata.disabled);
        }
    }
}

/**
 * A class representing a cron job definition.
 */
export class CronJobDefinition extends JobDefinition {
    readonly type: JobType = JobType.Cron;
    protected readonly trigger: CronJobTrigger;

    constructor(name: string, cronExpression: string, execute: JobFunction, initiallyDisabled?: boolean, timeZone?: string) {
        super(name, execute, initiallyDisabled);
        this.trigger = new CronJobTrigger(cronExpression, timeZone);
    }

    /**
     * Updates the cron expression for the job.
     * @param cronExpression The new cron expression.
     * @param timeZone The time zone for the cron expression.
     */
    public updateCronExpression(cronExpression: string, timeZone?: string): void {
        this.changeTrigger(new CronJobTrigger(cronExpression, timeZone));
    }
}

/**
 * A class representing an interval job definition.
 */
export class IntervalJobDefinition extends JobDefinition {
    readonly type: JobType = JobType.Interval;
    protected readonly trigger: JobTrigger;

    constructor(name: string, interval: number, execute: JobFunction, initiallyDisabled?: boolean) {
        super(name, execute, initiallyDisabled);
        this.trigger = new IntervalJobTrigger(interval);
    }

    /**
     * Updates the interval for the job.
     * @param interval The new interval.
     */
    public updateInterval(interval: number): void {
        this.changeTrigger(new IntervalJobTrigger(interval));
    }
}

/**
 * A class representing a date-based job definition.
 */
export class DateJobDefinition extends JobDefinition {
    readonly type: JobType = JobType.Date;
    protected readonly trigger: JobTrigger;

    constructor(name: string, date: Date, execute: JobFunction, initiallyDisabled?: boolean) {
        super(name, execute, initiallyDisabled);
        this.trigger = new DateJobTrigger(date);
    }

    /**
     * Updates the date for the job.
     * @param date The new date.
     */
    public updateDate(date: Date): void {
        this.changeTrigger(new DateJobTrigger(date));
    }
}

/**
 * A class representing a timeout job definition.
 */
export class TimeoutJobDefinition extends JobDefinition {
    readonly type: JobType = JobType.Timeout;
    protected readonly trigger: JobTrigger;

    constructor(name: string, timeout: number, execute: JobFunction, initiallyDisabled?: boolean) {
        super(name, execute, initiallyDisabled);
        this.trigger = new TimeoutJobTrigger(timeout);
    }

    /**
     * Updates the timeout for the job.
     * @param timeout The new timeout.
     */
    public updateTimeout(timeout: number): void {
        this.changeTrigger(new TimeoutJobTrigger(timeout));
    }
}
