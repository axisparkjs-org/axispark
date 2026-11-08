import { MetadataFromMethod } from '@axisparkjs/common';
import { JobType } from '../jobs';

/**
 * How an exclusive job is coordinated between the instances of the application:
 * - `once-per-occurrence`: each occurrence of the job runs on only one instance. The lock of an occurrence is not released, so an
 *   instance whose clock is slightly behind never runs the same occurrence again.
 * - `no-overlap`: the job never runs on two instances at the same time. The lock is extended while the job runs and released when it ends.
 */
export type JobExclusiveMode = 'once-per-occurrence' | 'no-overlap';

/** The options of an exclusive job. */
export interface JobExclusiveOptions {
    /** How the job is coordinated between the instances. Defaults to `once-per-occurrence`. */
    mode?: JobExclusiveMode;
    /**
     * The time to live of the lock in milliseconds. In `once-per-occurrence` mode, it defaults to the time between two occurrences
     * for cron and interval jobs, and to one minute for date and timeout jobs. In `no-overlap` mode, it defaults to 30 seconds and the lock
     * is extended every half of it while the job runs.
     */
    ttl?: number;
}

export interface JobMetadataBase extends MetadataFromMethod {
    type: JobType;
    value: any;
    name: string;
    disabled: boolean;
    /** Whether the job runs on only one instance of the application, using the lock store of the `SchedulePlugin`. */
    exclusive?: boolean | JobExclusiveOptions;
}
export interface CronJobMetadata extends JobMetadataBase {
    type: JobType.Cron;
    value: string;
    timeZone?: string;
}

export interface IntervalJobMetadata extends JobMetadataBase {
    type: JobType.Interval;
    value: number;
}

export interface DateJobMetadata extends JobMetadataBase {
    type: JobType.Date;
    value: Date;
}

export interface TimeoutJobMetadata extends JobMetadataBase {
    type: JobType.Timeout;
    value: number;
}

export type JobMetadata = JobMetadataBase & (CronJobMetadata | IntervalJobMetadata | DateJobMetadata | TimeoutJobMetadata);
