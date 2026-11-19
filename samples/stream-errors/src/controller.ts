import { Readable } from 'node:stream';
import { Controller, Get, HttpResults } from '@axisparkjs/http';

/**
 * Keeps the last endless stream, so a test can check that it is destroyed when the client disconnects.
 */
export const endless: { stream?: Readable } = {};

@Controller('streams')
export class StreamController {
    @Get('ok')
    ok() {
        return HttpResults.Stream(Readable.from(['Hello ', 'from ', 'a stream\n']), 'ok.txt', 'text/plain');
    }

    @Get('fail-before')
    failBefore() {
        const stream = new Readable({
            read() {
                this.destroy(new Error('upstream failed'));
            }
        });
        return HttpResults.Stream(stream, 'report.txt', 'text/plain');
    }

    @Get('fail-during')
    failDuring() {
        let sent = false;
        const stream = new Readable({
            read() {
                if (!sent) {
                    sent = true;
                    this.push('first chunk\n');
                    return;
                }
                setTimeout(() => this.destroy(new Error('upstream failed in the middle')), 20);
            }
        });
        return HttpResults.Stream(stream, 'report.txt', 'text/plain');
    }

    @Get('endless')
    endlessStream() {
        const stream = new Readable({
            read() {
                setTimeout(() => this.push('tick\n'), 10);
            }
        });
        endless.stream = stream;
        return HttpResults.Stream(stream, undefined, 'text/plain');
    }
}
