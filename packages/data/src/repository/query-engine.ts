import { Executable } from '@axisparkjs/common';
import { Injectable } from '@axisparkjs/di';
import { DataSource, ObjectLiteral } from 'typeorm';
import { BaseRepository } from './base-repository';
import { MongoQueryEngine } from './mongo-query-engine';
import { SQLQueryEngine } from './sql-query-engine';

export { Page, PageRequest } from './query-method-parser';

/**
 * Dispatches derived repository methods to the database-specific query engine.
 * Currently recognizes the SQL drivers listed in the DataPlugin guide and
 * routes MongoDB to {@link MongoQueryEngine}.
 */
@Injectable()
export class QueryEngine implements Executable {
    private readonly sqlDBMS = new Set([
        'mysql',
        'postgres',
        'cockroachdb',
        'sap',
        'spanner',
        'mariadb',
        'sqljs',
        'oracle',
        'mssql',
        'aurora-mysql',
        'aurora-postgres',
        'better-sqlite3'
    ]);
    private readonly mongoDBMS = new Set(['mongodb']);

    constructor(
        private readonly sqlQueryEngine: SQLQueryEngine,
        private readonly mongoQueryEngine: MongoQueryEngine
    ) {}

    /** Executes a derived repository method with the repository and its owning data source. */
    public execute<T extends ObjectLiteral>(object: BaseRepository<T>, property: string, classArgs: unknown[], methodArgs: unknown[]): Promise<unknown> {
        const [, dataSource] = classArgs as [unknown, DataSource];
        if (this.sqlDBMS.has(dataSource.options.type)) return this.sqlQueryEngine.execute(object, property, classArgs, methodArgs);
        if (this.mongoDBMS.has(dataSource.options.type)) return this.mongoQueryEngine.execute(object, property, classArgs, methodArgs);

        throw new Error(`Unsupported TypeORM driver: ${dataSource.options.type}`);
    }
}
