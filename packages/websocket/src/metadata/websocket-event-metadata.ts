import { MetadataFromMethod } from '@axisparkjs/common';

export interface WebSocketEventMetadata extends MetadataFromMethod {
    event: string | RegExp;
}
