import { Readable } from 'node:stream';
import path from 'node:path';
import { Controller, Get, HttpResults } from '@axisparkjs/http';

@Controller('files')
export class FileController {
    @Get('outside')
    outside() {
        return HttpResults.File(path.join(__dirname, 'outside.txt'));
    }

    @Get('public')
    public() {
        return HttpResults.File(path.join(__dirname, 'public', 'hello.txt'));
    }

    @Get('relative')
    relative() {
        return HttpResults.File('hello.txt');
    }

    @Get('missing')
    missing() {
        return HttpResults.File(path.join(__dirname, 'nope.txt'));
    }

    @Get('hidden')
    hidden() {
        return HttpResults.File(path.join(__dirname, '.hidden', 'secret.txt'));
    }

    @Get('typed')
    typed() {
        return HttpResults.File(path.join(__dirname, 'outside.txt'), 'application/octet-stream');
    }

    @Get('download')
    download() {
        return HttpResults.Download(path.join(__dirname, 'outside.txt'), 'report.txt', 'text/plain');
    }

    @Get('download-missing')
    downloadMissing() {
        return HttpResults.Download(path.join(__dirname, 'nope.txt'), 'report.txt');
    }

    @Get('stream')
    stream() {
        return HttpResults.Stream(Readable.from(['Hello ', 'from ', 'a stream\n']), 'stream.txt', 'text/plain');
    }
}
