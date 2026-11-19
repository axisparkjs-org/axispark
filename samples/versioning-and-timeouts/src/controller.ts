import { setTimeout as sleep } from 'node:timers/promises';
import { NoTimeout, Signal, Timeout } from '@axisparkjs/engine';
import { Controller, Get } from '@axisparkjs/http';

@Controller({ path: 'versions', version: '1' })
export class VersionController {
    @Get({
        path: '/',
        version: '3'
    })
    exampleGetV3() {
        return {
            message: 'This is a GET request example for version 3'
        };
    }

    @Get({
        path: '/',
        version: '2'
    })
    exampleGetV2() {
        return {
            message: 'This is a GET request example for version 2'
        };
    }

    @Get()
    exampleGetDefault() {
        return {
            message: 'This is a GET request example for the default version'
        };
    }
}

@Controller('timeouts')
export class TimeoutController {
    @Get()
    async exampleTimeout() {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
            message: 'This is a GET request example for timeouts'
        };
    }

    @Get('no-timeout')
    async exampleNoTimeout() {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
            message: 'This is a GET request example for no timeouts'
        };
    }

    @Get('disabled-timeout')
    @NoTimeout()
    async exampleDisabledTimeout() {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
            message: 'This is a GET request example with the timeout disabled'
        };
    }

    @Get('throw-timeout')
    async exampleThrowTimeout() {
        await new Promise((resolve) => setTimeout(resolve, 500));
        throw new Error('This is a GET request example that throws an error after timeout');
    }
}

@Controller('timeouts-disabled')
@NoTimeout()
export class DisabledTimeoutController {
    @Get()
    async exampleClassDisabledTimeout() {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
            message: 'This is a GET request example with the timeout disabled in its class'
        };
    }

    @Get('method-timeout')
    @Timeout(100)
    async exampleMethodTimeout() {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
            message: 'This is a GET request example with its own timeout'
        };
    }
}

/**
 * The last run of each slow report, so you can check that the work stops when the request times out or the client disconnects.
 */
export const reportRuns: Record<string, { steps: number; stopped: boolean; reason?: string }> = {};

/**
 * Slow handlers that pass the signal of the execution to their I/O (here, `setTimeout` of `node:timers/promises`), so their work stops when nobody will read the result.
 */
@Controller('reports')
export class ReportController {
    @Get('timed')
    @Timeout(200)
    async timedReport(@Signal() signal: AbortSignal) {
        return await this.build('timed', signal);
    }

    @Get('long')
    @NoTimeout()
    async longReport(@Signal() signal: AbortSignal) {
        return await this.build('long', signal);
    }

    private async build(name: string, signal: AbortSignal) {
        const run = (reportRuns[name] = { steps: 0, stopped: false } as (typeof reportRuns)[string]);
        try {
            for (let step = 0; step < 20; step++) {
                await sleep(50, undefined, { signal });
                run.steps++;
            }
            return { steps: run.steps };
        } catch (error) {
            run.stopped = true;
            run.reason = (signal.reason as Error | undefined)?.name;
            throw error;
        }
    }
}
