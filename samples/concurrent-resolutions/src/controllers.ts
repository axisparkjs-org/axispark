import { Inject } from '@axisparkjs/di';
import { Controller, Get } from '@axisparkjs/http';
import { REMOTE_CONFIG, RemoteConfig } from './remote-config';

@Controller('greeting')
export class GreetingController {
    constructor(@Inject(REMOTE_CONFIG) private readonly config: RemoteConfig) {}

    @Get()
    greeting() {
        return { greeting: this.config.greeting, instance: this.config.instance };
    }
}

@Controller('status')
export class StatusController {
    @Get()
    status() {
        return { status: 'UP' };
    }
}
