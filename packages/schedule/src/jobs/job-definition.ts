import { Executable } from '@axisparkjs/common';
import { CronJobTrigger, DateJobTrigger, IntervalJobTrigger, JobTrigger, TimeoutJobTrigger } from './job-trigger';
import { JobMetadata } from '../metadata';

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
 * An abstract class representing a job definition.
 */
export abstract class JobDefinition implements Executable {
    abstract readonly type: JobType;
    protected abstract trigger: JobTrigger;
    protected lastExecutionTime?: Date;

    public constructor(
        public readonly name: string,
        private readonly job: () => Promise<void>,
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
        return this.trigger.getNextExecutionTime(this.lastExecutionTime);
    }

    /**
     * Executes the job.
     * @returns A promise resolving when the job has been executed.
     */
    public async execute(): Promise<void> {
        this.lastExecutionTime = new Date();
        await this.job();
    }

    /**
     * Creates a job definition from metadata.
     * @param metadata The metadata for the job.
     * @param execute The function to execute when the job runs.
     * @returns The created job definition.
     */
    public static fromMetadata(metadata: JobMetadata, execute: () => Promise<void>): JobDefinition {
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

    constructor(name: string, cronExpression: string, execute: () => Promise<void>, initiallyDisabled?: boolean, timeZone?: string) {
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

    constructor(name: string, interval: number, execute: () => Promise<void>, initiallyDisabled?: boolean) {
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

    constructor(name: string, date: Date, execute: () => Promise<void>, initiallyDisabled?: boolean) {
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

    constructor(name: string, timeout: number, execute: () => Promise<void>, initiallyDisabled?: boolean) {
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
