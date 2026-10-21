import { WebSocketEventHandler } from './websocket-event-handler';
import { ClassType } from '@axisparkjs/common';

/**
 * A class representing the definition of an WebSocket event handler.
 */
export class WebSocketEventDefinition {
    constructor(
        public readonly target: ClassType,
        public readonly propertyKey: string | symbol,
        public readonly namespace: string,
        public readonly event: string | RegExp,
        public readonly handler: WebSocketEventHandler
    ) {}
}
