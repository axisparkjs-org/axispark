import { Generator, Metadata, MetadataKeys, ClassType, MethodType } from '@axisparkjs/common';
import { ClassRegistry, Injectable, Injector } from '@axisparkjs/di';
import { JobDefinition } from './job-definition';
import { JobMetadata } from '../metadata';

/**
 * A generator for creating job definitions from metadata.
 */
@Injectable()
export class JobGenerator implements Generator<Promise<JobDefinition[]>> {
    constructor(private readonly injector: Injector) {}
    /**
     * Generates job definitions from metadata.
     * @returns A promise resolving to an array of job definitions.
     */
    async generate(): Promise<JobDefinition[]> {
        const schedulers = ClassRegistry.getWithMetadata(MetadataKeys.SCHEDULER);
        const jobs: JobDefinition[] = [];

        for (const scheduler of schedulers) {
            const jobsMetadata = Metadata.get<JobMetadata[]>(MetadataKeys.JOB, scheduler) ?? [];

            for (const jobMetadata of jobsMetadata) {
                // The job methods are called directly, without the execution engine, and receive the abort signal of the execution.
                const method = async (signal: AbortSignal) => {
                    const jobInstance = await this.injector.get(jobMetadata.target as ClassType<JobDefinition>);
                    const jobMethod = (jobInstance[jobMetadata.propertyKey as keyof typeof jobInstance] as MethodType).bind(jobInstance);
                    await jobMethod(signal);
                };
                jobs.push(JobDefinition.fromMetadata(jobMetadata, method.bind(this)));
            }
        }
        return jobs;
    }
}
