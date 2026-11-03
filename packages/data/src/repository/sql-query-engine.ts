import { Injectable } from '@axisparkjs/di';
import { Brackets, DataSource, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { TransactionContext } from '../transactions/transaction-context';
import { BaseRepository } from './base-repository';
import { ParsedMethod, ParsedPredicate, QueryMethodParser } from './query-method-parser';

/** Executes derived repository methods by building TypeORM SQL `SelectQueryBuilder` queries. */
@Injectable()
export class SQLQueryEngine {
    constructor(private readonly queryMethodParser: QueryMethodParser) {}

    /**
     * Parses and executes a derived method against a relational TypeORM repository.
     *
     * @param _object Repository proxy target supplied by the executable interface.
     * @param property Derived method name, for example `findByStatus`.
     * @param classArgs Repository and owning data source constructor arguments. Inside a transaction of
     * that data source, the query runs on the transactional repository.
     * @param methodArgs Predicate values, optionally followed by a `PageRequest`.
     */
    public async execute<T extends ObjectLiteral>(_object: BaseRepository<T>, property: string, classArgs: unknown[], methodArgs: unknown[]): Promise<unknown> {
        const [defaultEntityRepository, dataSource] = classArgs as [Repository<T>, DataSource];
        const entityRepository =
            defaultEntityRepository && dataSource ? TransactionContext.resolveRepository(defaultEntityRepository, dataSource) : defaultEntityRepository;
        if (!entityRepository || typeof entityRepository.createQueryBuilder !== 'function') {
            throw new Error('A TypeORM Repository must be the first repository constructor argument.');
        }

        const parsed = this.queryMethodParser.parse(entityRepository, property);
        const { methodArgs: predicateArgs, pageRequest } = this.queryMethodParser.extractPageRequest(parsed.operation, methodArgs);
        if (parsed.order.length > 0 && (parsed.operation === 'count' || parsed.operation === 'exists')) {
            throw new Error(`OrderBy is not supported for '${property}'.`);
        }

        const query = entityRepository.createQueryBuilder('entity');
        this.applyPredicates(query, parsed.predicateGroups, predicateArgs);
        this.applyOrder(query, parsed.order);
        if (pageRequest) query.skip(pageRequest.page * pageRequest.size).take(pageRequest.size);

        switch (parsed.operation) {
            case 'findMany':
                return query.getMany();
            case 'findOne':
                return query.getOne();
            case 'count':
                return query.getCount();
            case 'exists':
                return (await query.getCount()) > 0;
        }
    }

    private applyPredicates<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, groups: ParsedPredicate[][], methodArgs: unknown[]): void {
        const expectedArgs = groups.flat().reduce((total, predicate) => total + predicate.arity, 0);
        if (methodArgs.length !== expectedArgs) {
            throw new Error(`Derived query expected ${expectedArgs} argument(s), received ${methodArgs.length}.`);
        }

        let argIndex = 0;
        groups.forEach((group, groupIndex) => {
            const bracket = new Brackets((where) => {
                group.forEach(({ propertyPath, operator, arity }, predicateIndex) => {
                    const column = `entity.${propertyPath}`;
                    const parameters: Record<string, unknown> = {};
                    const names = Array.from({ length: arity }, () => {
                        const name = `queryArg${argIndex}`;
                        parameters[name] = methodArgs[argIndex++];
                        return name;
                    });
                    const expression = this.toSql(column, operator, names);
                    if (predicateIndex === 0) where.where(expression, parameters);
                    else where.andWhere(expression, parameters);
                });
            });

            if (groupIndex === 0) query.where(bracket);
            else query.orWhere(bracket);
        });
    }

    private toSql(column: string, operator: ParsedPredicate['operator'], args: string[]): string {
        switch (operator) {
            case 'IsNotNull':
                return `${column} IS NOT NULL`;
            case 'IsNull':
                return `${column} IS NULL`;
            case 'GreaterThanEqual':
                return `${column} >= :${args[0]}`;
            case 'LessThanEqual':
                return `${column} <= :${args[0]}`;
            case 'GreaterThan':
                return `${column} > :${args[0]}`;
            case 'LessThan':
                return `${column} < :${args[0]}`;
            case 'Between':
                return `${column} BETWEEN :${args[0]} AND :${args[1]}`;
            case 'In':
                return `${column} IN (:...${args[0]})`;
            case 'Like':
                return `${column} LIKE :${args[0]}`;
            default:
                return `${column} = :${args[0]}`;
        }
    }

    private applyOrder<T extends ObjectLiteral>(query: SelectQueryBuilder<T>, order: ParsedMethod['order']): void {
        order.forEach(({ propertyPath, direction }, index) => {
            const column = `entity.${propertyPath}`;
            if (index === 0) query.orderBy(column, direction);
            else query.addOrderBy(column, direction);
        });
    }
}
