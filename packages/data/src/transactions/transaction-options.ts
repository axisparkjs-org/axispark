/** Transaction isolation levels supported by TypeORM. Support depends on the database driver. */
export type TransactionIsolationLevel = 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' | 'SNAPSHOT';

/** Options shared by {@link Transactional} and {@link TransactionManager.runInTransaction}. */
export interface TransactionOptions {
    /**
     * Name of the configured data source the transaction runs on. It can be
     * omitted when only one data source is configured.
     */
    dataSource?: string;

    /**
     * TypeORM isolation level, for example `READ COMMITTED` or `SERIALIZABLE`.
     * When omitted, the database default is used. It is ignored when the call
     * joins a transaction that is already open on the same data source.
     */
    isolationLevel?: TransactionIsolationLevel;
}
