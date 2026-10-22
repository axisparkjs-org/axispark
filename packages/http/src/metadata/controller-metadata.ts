import { MetadataFromClass } from '@axisparkjs/common';

export interface ControllerMetadata extends MetadataFromClass {
    path: string;
    host?: string | string[];
    version?: string | string[];
}
