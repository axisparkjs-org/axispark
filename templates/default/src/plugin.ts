import { EnvSettings, Plugin } from '@axisparkjs/core';
import { Injectable } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';
import { AppSettings } from './settings';

export const registerText = 'HelloWorldPlugin registered';
export const startText = 'HelloWorldPlugin started';
export const stopText = 'HelloWorldPlugin stopped';

@Injectable()
export class HelloWorldPlugin extends Plugin {
    constructor(
        private readonly logger: Logger,
        @EnvSettings() private readonly settings: AppSettings
    ) {
        super();
    }

    async onRegister() {
        await this.logger.info(registerText);
    }

    async onStart() {
        await this.logger.info(startText);
        await this.logger.info(this.settings.greeting);
    }

    async onStop() {
        await this.logger.info(stopText);
    }
}
