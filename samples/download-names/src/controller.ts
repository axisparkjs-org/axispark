import { createReadStream } from 'node:fs';
import path from 'node:path';
import { Controller, Get, HttpResults, Query } from '@axisparkjs/http';

const REPORT = path.join(__dirname, 'files', 'report.txt');

@Controller('downloads')
export class DownloadController {
    @Get('file')
    file(@Query('name') name: string) {
        return HttpResults.Download(REPORT, name, 'text/plain');
    }

    @Get('stream')
    stream(@Query('name') name: string) {
        return HttpResults.Stream(createReadStream(REPORT), name, 'text/plain');
    }
}
