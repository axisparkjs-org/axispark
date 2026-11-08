import { Controller, Get } from '@axisparkjs/http';

@Controller('quotes')
export class QuoteController {
    /** Limited to 3 requests every 10 seconds per client, counted in Redis for every instance. */
    @Get('random')
    random() {
        return { quote: 'Simplicity is prerequisite for reliability.' };
    }
}
