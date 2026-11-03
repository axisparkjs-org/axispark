import { Inject, Injectable } from '@axisparkjs/di';
import { Logger } from '@axisparkjs/logger';
import { DataSource, EntityManager } from 'typeorm';
import { DataSourceConnectionManager } from '../connections';
import { DATA_LOGGER } from '../di';
import { TransactionContext } from './transaction-context';
import { TransactionOptions } from './transaction-options';

/**
 * Runs code inside a database transaction. Every repository call made inside the
 * callback, including derived query methods, joins the transaction of its data
 * source automatically.
 *
 * - Nested calls on the same data source join the transaction that is already open.
 * - If the callback throws, the transaction is rolled back and the error is rethrown.
 *   Otherwise it is committed when the callback resolves.
 * - A transaction covers one data source only. Repositories of other data sources
 *   used inside the callback are not part of it.
 * - MongoDB data sources run the callback without a transaction and log a warning.
 *
 * @example
 * ```ts
 * constructor(private readonly transactionManager: TransactionManager) {}
 *
 * placeOrder(order: Order) {
 *     return this.transactionManager.runInTransaction(async () => {
 *         await this.stock.reserve(order.items);
 *         return this.orders.save(order);
 *     });
 * }
 * ```
 */
@Injectable()
export class TransactionManager {
    private static active?: TransactionManager;
    private readonly mongoWarnings = new Set<string>();

    constructor(
        private readonly dataSourceConnectionManager: DataSourceConnectionManager,
        @Inject(DATA_LOGGER) private readonly logger: Logger
    ) {}

    /**
     * Returns the transaction manager of the running application. It is used by
     * {@link Transactional} and is available once the `DataPlugin` is registered.
     */
    static getActive(): TransactionManager {
        if (!TransactionManager.active) {
            throw new Error('No TransactionManager is available. Register the DataPlugin before running transactional methods.');
        }
        return TransactionManager.active;
    }

    /** Sets the transaction manager returned by {@link TransactionManager.getActive}. */
    static setActive(transactionManager: TransactionManager): void {
        TransactionManager.active = transactionManager;
    }

    /** Clears the active transaction manager, if it is the given one. */
    static clearActive(transactionManager: TransactionManager): void {
        if (TransactionManager.active === transactionManager) TransactionManager.active = undefined;
    }

    /**
     * Runs the callback inside a transaction of the selected data source.
     *
     * @param callback Code to run. It receives the transactional `EntityManager`.
     * @param options Data source and isolation level of the transaction.
     * @returns The value the callback resolves with, once the transaction is committed.
     */
    async runInTransaction<T>(callback: (entityManager: EntityManager) => Promise<T> | T, options: TransactionOptions = {}): Promise<T> {
        const [name, dataSource] = this.getDataSource(options.dataSource);

        const activeManager = TransactionContext.getEntityManager(dataSource);
        if (activeManager) return callback(activeManager);

        if (dataSource.options.type === 'mongodb') {
            this.warnMongoDB(name);
            return callback(dataSource.manager);
        }

        const run = (manager: EntityManager) => TransactionContext.run(dataSource, manager, async () => callback(manager));
        return options.isolationLevel ? dataSource.transaction(options.isolationLevel, run) : dataSource.transaction(run);
    }

    private getDataSource(name?: string): [string, DataSource] {
        const connections = this.dataSourceConnectionManager.getAllConnections();
        if (name === undefined) {
            if (connections.size !== 1) {
                throw new Error(
                    `The 'dataSource' transaction option is required when ${connections.size} data sources are configured. Available data sources: ${[...connections.keys()].join(', ')}.`
                );
            }
            return [...connections.entries()][0];
        }

        const dataSource = connections.get(name);
        if (!dataSource) throw new Error(`Data source '${name}' not found. Available data sources: ${[...connections.keys()].join(', ')}.`);
        return [name, dataSource];
    }

    private warnMongoDB(name: string): void {
        if (this.mongoWarnings.has(name)) return;
        this.mongoWarnings.add(name);
        void this.logger.warn(`Data source '${name}' uses MongoDB: transactional methods run without a transaction.`);
    }
}
