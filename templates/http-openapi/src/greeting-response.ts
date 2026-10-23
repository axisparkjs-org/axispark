import { OpenApiProperty, OpenApiSchema } from '@axisparkjs/openapi';

@OpenApiSchema({ description: 'The response returned by the example endpoint.' })
export class GreetingResponse {
    @OpenApiProperty({ type: 'string', description: 'A greeting message.', example: 'Hello, world!' })
    message: string;
}
