import { Controller, Get } from '@axisparkjs/http';
import { OpenApiResponse } from '@axisparkjs/openapi';
import { GreetingResponse } from './greeting-response';

@Controller('example')
export class ExampleController {
    @Get()
    @OpenApiResponse({ statusCode: 200, type: GreetingResponse, description: 'A greeting from the example API.' })
    get(): GreetingResponse {
        return { message: 'Hello, world!' };
    }
}
