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

    @Get('throw-timeout')
    async exampleThrowTimeout() {
        await new Promise((resolve) => setTimeout(resolve, 500));
        throw new Error('This is a GET request example that throws an error after timeout');
    }
}
