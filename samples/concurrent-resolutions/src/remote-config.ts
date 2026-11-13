import { InjectionToken } from '@axisparkjs/di';

export const REMOTE_CONFIG = new InjectionToken('REMOTE_CONFIG');

export class RemoteConfig {
    static created = 0;

    readonly instance: number;

    constructor(readonly greeting: string) {
        this.instance = ++RemoteConfig.created;
    }
}

/**
 * Simulates a configuration that is loaded from a remote service: the factory takes some time to create the instance.
 */
export const loadRemoteConfig = async (): Promise<RemoteConfig> => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return new RemoteConfig('Hello from the remote configuration');
};
