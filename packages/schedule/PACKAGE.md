# `@axisparkjs/schedule`

Job scheduling for AxiSpark.js with cron expressions, intervals, timeouts and dates.

The complete guide is in the [Schedule Plugin documentation](https://axisparkjs.com/docs/category/schedule-plugin).

## What the package does

- Discovers classes decorated with `@Scheduler()` and starts their jobs when the application runs.
- Declares jobs with `@Cron()`, `@Interval()`, `@Timeout()` and `@DateSchedule()`.
- Starts and stops jobs at runtime through the `SchedulerService`.

## Install and register

```bash
npm install @axisparkjs/schedule
```

```ts title="app.ts"
import { AxiSparkFactory } from '@axisparkjs/core';
import { SchedulePlugin } from '@axisparkjs/schedule';

const app = AxiSparkFactory.create({ name: 'Example', basePath: __dirname });

app.use(SchedulePlugin);
```

```ts title="jobs.ts"
import { Logger } from '@axisparkjs/logger';
import { Cron, CronExpression, Interval, Scheduler } from '@axisparkjs/schedule';

@Scheduler()
export class ReportJobs {
    constructor(private readonly logger: Logger) {}

    @Cron(CronExpression.EverySecond)
    async everySecond() {
        await this.logger.info('Cron job executed');
    }

    @Interval({ value: 5000, name: 'everyFiveSeconds' })
    async everyFiveSeconds() {
        await this.logger.info('Interval job executed');
    }
}
```
