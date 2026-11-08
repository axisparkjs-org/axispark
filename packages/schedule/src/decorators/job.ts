import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { CronJobMetadata, DateJobMetadata, IntervalJobMetadata, JobMetadata, TimeoutJobMetadata } from '../metadata/job-metadata';
import { JobType } from '../jobs';

/**
 * A decorator for defining jobs.
 * @param data The metadata for the job.
 * @returns A method decorator.
 */
function Job(data: Partial<Exclude<JobMetadata, 'type'>> & Pick<JobMetadata, 'type' | 'value'>): MethodDecorator {
    return (target, propertyKey) => {
        const jobs = Metadata.get<JobMetadata[]>(MetadataKeys.JOB, target) ?? [];

        jobs.push({
            target: Metadata.normalizeTarget(target),
            propertyKey,
            name: data.name ?? `${target.constructor.name.toLocaleLowerCase()}.${propertyKey.toString().toLocaleLowerCase()}`,
            disabled: data.disabled ?? false,
            ...data
        });

        Metadata.define(MetadataKeys.JOB, jobs, target);
    };
}

type JobParameters = Partial<Pick<JobMetadata, 'name' | 'disabled' | 'exclusive'>>;

/**
 * A decorator for defining cron jobs.
 * @param value The cron expression or job parameters.
 * @returns A method decorator.
 */
export const Cron = (value: string | (JobParameters & Pick<CronJobMetadata, 'value' | 'timeZone'>)) =>
    Job(value instanceof Object ? { type: JobType.Cron, ...value } : { type: JobType.Cron, value });

/**
 * A decorator for defining interval jobs.
 * @param value The interval value or job parameters.
 * @returns A method decorator.
 */
export const Interval = (value: number | (JobParameters & Pick<IntervalJobMetadata, 'value'>)) =>
    Job(value instanceof Object ? { type: JobType.Interval, ...value } : { type: JobType.Interval, value });

/**
 * A decorator for defining date-based jobs.
 * @param value The date value or job parameters.
 * @returns A method decorator.
 */
export const DateSchedule = (value: Date | (JobParameters & Pick<DateJobMetadata, 'value'>)) =>
    Job(!(value instanceof Date) ? { type: JobType.Date, ...value } : { type: JobType.Date, value });

/**
 * A decorator for defining timeout jobs.
 * @param value The timeout value or job parameters.
 * @returns A method decorator.
 */
export const Timeout = (value: number | (JobParameters & Pick<TimeoutJobMetadata, 'value'>)) =>
    Job(value instanceof Object ? { type: JobType.Timeout, ...value } : { type: JobType.Timeout, value });
