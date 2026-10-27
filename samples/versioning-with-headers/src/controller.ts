import { Controller, Get } from '@axisparkjs/http';

@Controller({ path: 'versions' })
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
            message: 'All versions are supported for this GET request example'
        };
    }

    @Get({
        path: '/especial',
        version: ['3', '2']
    })
    exampleGetEspecialV3V2() {
        return {
            message: 'This is a GET request example for version 3 and 2 especial'
        };
    }
}
