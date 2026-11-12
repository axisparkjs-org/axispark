import { Controller, Get } from '@axisparkjs/http';

@Controller('status')
export class StatusController {
    @Get()
    status() {
        return { status: 'UP' };
    }
}
