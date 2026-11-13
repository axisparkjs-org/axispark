import { AxiSparkContext, Plugin } from '@axisparkjs/core';
import { Injectable, InjectableScopes } from '@axisparkjs/di';
import { loadRemoteConfig, REMOTE_CONFIG, RemoteConfig } from './remote-config';

@Injectable()
export class RemoteConfigPlugin extends Plugin {
    async onRegister(context: AxiSparkContext) {
        context.container.bind({
            token: REMOTE_CONFIG,
            forClass: RemoteConfig,
            scope: InjectableScopes.Singleton,
            useFactory: loadRemoteConfig
        });
    }
}
