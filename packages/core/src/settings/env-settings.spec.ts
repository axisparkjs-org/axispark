import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { AXISPARK_ENV_SETTINGS, EnvSettings } from './env-settings';

describe('EnvSettings', () => {
    it('should inject the AXISPARK_ENV_SETTINGS token', () => {
        @Injectable()
        class MailService {
            constructor(@EnvSettings() public readonly settings: EnvSettings) {}
        }

        const metadata = Metadata.get<{ params: Map<number, unknown> }>(MetadataKeys.INJECT, MailService);
        expect(metadata?.params.get(0)).toBe(AXISPARK_ENV_SETTINGS);
    });
});
