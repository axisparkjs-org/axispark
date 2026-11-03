import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, EntityManager, ObjectLiteral, Repository } from 'typeorm';

/** Transactional entity managers of the current async context, by data source. */
export type TransactionStore = ReadonlyMap<DataSource, EntityManager>;

const transactionStorage = new AsyncLocalStorage<TransactionStore>();

/** Returns the transactional entity manager of the data source, if a transaction is open on it. */
const getEntityManager = (dataSource: DataSource): EntityManager | undefined => transactionStorage.getStore()?.get(dataSource);

/**
 * Access to the transactions that are open in the current async context.
 * Repositories and query engines use it to join the active transaction of their data source.
 */
export const TransactionContext = {
    getEntityManager,

    /** Returns whether a transaction is open on the data source in the current async context. */
    isActive(dataSource: DataSource): boolean {
        return getEntityManager(dataSource) !== undefined;
    },

    /**
     * Returns the repository bound to the active transaction of the data source,
     * or the given repository when there is no transaction open on it.
     */
    resolveRepository<T extends ObjectLiteral, R extends Repository<T>>(repository: R, dataSource: DataSource): R {
        const manager = getEntityManager(dataSource);
        if (!manager) return repository;

        return (dataSource.options.type === 'mongodb' ? manager.getMongoRepository(repository.target) : manager.getRepository(repository.target)) as R;
    },

    /** Runs the callback with the entity manager registered as the active transaction of the data source. */
    run<T>(dataSource: DataSource, manager: EntityManager, callback: () => T): T {
        const store = new Map(transactionStorage.getStore());
        store.set(dataSource, manager);
        return transactionStorage.run(store, callback);
    }
};
