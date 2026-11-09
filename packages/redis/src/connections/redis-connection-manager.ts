import { Injectable, Inject } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';
import { createClient, RedisClientType } from 'redis';
import { REDIS_LOGGER, REDIS_OPTIONS } from '../di';
import { RedisConnectionOptions, RedisPluginOptions } from '../plugin/redis-plugin-options';

/**
 * A manager for creating and managing named connections to Redis.
 */
@Injectable()
export class RedisConnectionManager {
    private readonly connections = new Map<string, RedisClientType>();

    constructor(
        @Inject(REDIS_OPTIONS) private readonly redisPluginOptions: RedisPluginOptions,
        @Inject(REDIS_LOGGER) private readonly logger: Logger
    ) {}

    /**
     * Creates and connects a client for each configured connection.
     *
     * The clients connect in the background, so the application starts even when Redis is not available: the errors are logged
     * and the clients keep reconnecting with their reconnect strategy until they are ready.
     * @throws An error when two connections have the same name.
     */
    async createConnections(): Promise<void> {
        for (const connectionConfig of this.redisPluginOptions.connections) {
            const { name } = connectionConfig;
            if (this.connections.has(name)) {
                throw new Error(`Connection with name '${name}' already exists. Connection names must be unique.`);
            }

            const connection = this.createConnection(connectionConfig);
            this.connections.set(name, connection);
            // The connection errors are reported through the `error` event, so the rejection of `connect` is ignored.
            connection.connect().catch(() => undefined);
        }
    }

    private createConnection({ name, url, options }: RedisConnectionOptions): RedisClientType {
        const connection = createClient({ ...options, url }) as RedisClientType;
        connection.on('ready', () => this.logger.info(`Connection '${name}' established`));
        connection.on('reconnecting', () => this.logger.warn(`Connection '${name}' reconnecting`));
        // node-redis stops the process when an `error` event is not listened to, so this listener is always registered.
        connection.on('error', (error: Error) => this.logger.error(`Connection '${name}' encountered an error`, error));
        connection.on('end', () => this.logger.info(`Connection '${name}' finished`));
        return connection;
    }

    getConnection(name: string): RedisClientType | undefined {
        return this.connections.get(name);
    }

    getAllConnections(): Map<string, RedisClientType> {
        return new Map(this.connections);
    }

    /**
     * Closes every connection. Open connections wait for their pending commands, and the clients that are reconnecting stop reconnecting.
     */
    async destroyConnections(): Promise<void> {
        for (const [name, connection] of this.connections.entries()) {
            if (connection.isOpen) await connection.close();
            this.connections.delete(name);
        }
    }
}
