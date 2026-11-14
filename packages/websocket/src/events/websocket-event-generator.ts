import { ClassRegistry, Injectable, ScopedContainerManager } from '@axisparkjs/di';
import { Generator, Metadata, MetadataKeys } from '@axisparkjs/common';
import { WebSocketEventDefinition } from './websocket-event-definition';
import { ExecutionTransport } from '@axisparkjs/engine';
import { WebSocketEngine } from '../engine/websocket-engine';
import { WebSocketContext } from '../types';
import { WebSocketEventMetadata, WebSocketMetadata } from '../metadata';

/**
 * A generator for creating WebSocket event definitions based on WebSocket metadata.
 */
@Injectable()
export class WebSocketEventGenerator implements Generator<WebSocketEventDefinition[]> {
    constructor(
        private readonly websocketEngine: WebSocketEngine,
        private readonly scopedContainerManager: ScopedContainerManager
    ) {}

    /**
     * Generates WebSocket event definitions based on WebSockets metadata.
     * @returns An array of WebSocket event definitions.
     */
    async generate(): Promise<WebSocketEventDefinition[]> {
        const websocketEvents: WebSocketEventDefinition[] = [];

        const websockets = ClassRegistry.getWithMetadata(MetadataKeys.WEBSOCKET);
        for (const websocket of websockets) {
            const websocketMetadata = Metadata.get<WebSocketMetadata>(MetadataKeys.WEBSOCKET, websocket) as WebSocketMetadata;
            const eventsMetadata = Metadata.get<WebSocketEventMetadata[]>(MetadataKeys.WEBSOCKET_EVENT, websocket) ?? [];

            for (const eventMetadata of eventsMetadata) {
                const eventDefinition = new WebSocketEventDefinition(
                    eventMetadata.target,
                    eventMetadata.propertyKey,
                    this.normalizeNamespace(websocketMetadata.namespace),
                    eventMetadata.event,
                    async (context) => await this.websocketEngine.execute(this.fillContext(context, eventMetadata))
                );
                websocketEvents.push(eventDefinition);
            }
        }
        return websocketEvents;
    }

    private normalizeNamespace(namespace: string): string {
        if (!namespace.startsWith('/')) {
            return `/${namespace}`;
        }
        return namespace;
    }

    private fillContext(context: Pick<WebSocketContext, 'message' | 'connection'>, eventMetadata: WebSocketEventMetadata): WebSocketContext {
        return {
            ...context,
            target: eventMetadata.target,
            propertyKey: eventMetadata.propertyKey,
            scopedContainer: this.scopedContainerManager.create(),
            transport: ExecutionTransport.WebSocket,
            // The engine replaces it with the signal of the execution, aborted when this one is.
            signal: context.connection.signal ?? new AbortController().signal,
            error: undefined
        };
    }
}
