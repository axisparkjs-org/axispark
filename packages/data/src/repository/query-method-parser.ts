import { Injectable } from '@axisparkjs/di';
import { ObjectLiteral, Repository } from 'typeorm';

/** Operation selected by a supported derived method prefix. */
export type QueryOperation = 'findMany' | 'findOne' | 'count' | 'exists';
/** Recognized suffix for a derived predicate. */
export type PredicateOperatorName =
    'Equal' | 'IsNull' | 'IsNotNull' | 'GreaterThanEqual' | 'LessThanEqual' | 'GreaterThan' | 'LessThan' | 'Between' | 'In' | 'Like';

export interface ParsedPredicate {
    /** TypeORM metadata path of the entity property. */
    propertyPath: string;
    /** Comparison operation represented by this predicate. */
    operator: PredicateOperatorName;
    /** Number of method arguments consumed by this predicate. */
    arity: number;
}

/** Normalized structure shared by SQL and Mongo query engines. */
export interface ParsedMethod {
    /** Result operation inferred from the method prefix. */
    operation: QueryOperation;
    // OR groups contain AND-connected predicates: (a AND b) OR (c AND d).
    /** AND-connected predicate groups, combined with OR between groups. */
    predicateGroups: ParsedPredicate[][];
    /** Ordered entity properties requested by the optional `OrderBy` clause. */
    order: { propertyPath: string; direction: 'ASC' | 'DESC' }[];
}

const OPERATORS: { suffix: PredicateOperatorName; arity: number }[] = [
    { suffix: 'IsNotNull', arity: 0 },
    { suffix: 'IsNull', arity: 0 },
    { suffix: 'GreaterThanEqual', arity: 1 },
    { suffix: 'LessThanEqual', arity: 1 },
    { suffix: 'GreaterThan', arity: 1 },
    { suffix: 'LessThan', arity: 1 },
    { suffix: 'Between', arity: 2 },
    { suffix: 'In', arity: 1 },
    { suffix: 'Like', arity: 1 }
];

@Injectable()
/** Parses repository method names and page arguments into a database-neutral query description. */
export class QueryMethodParser {
    /** Parses a supported derived method name against the entity's TypeORM metadata. */
    parse<T extends ObjectLiteral>(repository: Repository<T>, methodName: string): ParsedMethod {
        const methodMatch = /^(findOneBy|findBy|countBy|existsBy)(.+)$/.exec(methodName);
        if (!methodMatch) throw new Error(`Unsupported derived repository method '${methodName}'.`);

        const [, prefix, methodBody] = methodMatch;
        const operation: QueryOperation = prefix === 'findOneBy' ? 'findOne' : prefix === 'findBy' ? 'findMany' : prefix === 'countBy' ? 'count' : 'exists';
        const columns = repository.metadata.columns
            .map((column) => {
                const propertyPath = column.propertyPath ?? column.propertyName;
                return { propertyPath, tag: this.toPropertyTag(propertyPath) };
            })
            .sort((a, b) => b.tag.length - a.tag.length);

        return { operation, ...this.parsePredicates({ body: methodBody, methodName, columns }, 0, 'By') };
    }

    /** Removes and validates a final page request argument, when present. */
    extractPageRequest(operation: QueryOperation, methodArgs: unknown[]): { methodArgs: unknown[]; pageRequest?: PageRequest } {
        const candidate = methodArgs[methodArgs.length - 1];
        if (!candidate || typeof candidate !== 'object' || !('page' in candidate) || !('size' in candidate)) return { methodArgs };

        const { page, size } = candidate as PageRequest;
        if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1) {
            throw new Error('PageRequest requires a non-negative integer page and a positive integer size.');
        }
        if (operation !== 'findMany') throw new Error('PageRequest is only supported by findBy methods.');

        return { methodArgs: methodArgs.slice(0, -1), pageRequest: { page, size } };
    }

    /** Converts a metadata property path such as `profile.education` to `ProfileEducation`. */
    toPropertyTag(propertyPath: string): string {
        return propertyPath
            .split('.')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
    }

    /**
     * Reads the predicates that start at `position`, from left to right. Property names are matched against the entity
     * columns (longest first) before `And`, `Or` and `OrderBy` are read as keywords, so a property such as `originCountry`
     * or `orderId` is never split. When a match cannot be continued, the next shorter match is tried.
     */
    private parsePredicates(context: ParseContext, position: number, previousKeyword: 'By' | 'And' | 'Or'): Pick<ParsedMethod, 'predicateGroups' | 'order'> {
        const { body } = context;
        let firstError: Error | undefined;

        for (const { predicate, end } of this.matchPredicates(context, position)) {
            if (end === body.length) return { predicateGroups: [[predicate]], order: [] };

            for (const keyword of ['OrderBy', 'And', 'Or'] as const) {
                if (!body.startsWith(keyword, end)) continue;
                try {
                    const next = end + keyword.length;
                    if (keyword === 'OrderBy') return { predicateGroups: [[predicate]], order: this.parseOrder(context, next, 'OrderBy') };

                    const rest = this.parsePredicates(context, next, keyword);
                    if (keyword === 'And') rest.predicateGroups[0].unshift(predicate);
                    else rest.predicateGroups.unshift([predicate]);
                    return rest;
                } catch (error) {
                    firstError ??= error as Error;
                }
            }
        }

        if (firstError) throw firstError;
        throw this.predicateError(context, position, previousKeyword);
    }

    /** Lists the property and operator combinations that start at `position`, longest property first. */
    private matchPredicates({ body, columns }: ParseContext, position: number): { predicate: ParsedPredicate; end: number }[] {
        return columns
            .filter(({ tag }) => body.startsWith(tag, position))
            .flatMap(({ propertyPath, tag }) => {
                const operatorPosition = position + tag.length;
                const operators = OPERATORS.filter(({ suffix }) => body.startsWith(suffix, operatorPosition)).map(({ suffix, arity }) => ({
                    predicate: { propertyPath, operator: suffix, arity },
                    end: operatorPosition + suffix.length
                }));
                return [...operators, { predicate: { propertyPath, operator: 'Equal' as const, arity: 1 }, end: operatorPosition }];
            });
    }

    private predicateError({ body, methodName }: ParseContext, position: number, previousKeyword: 'By' | 'And' | 'Or'): Error {
        const text = body.slice(position);

        if (/^And(?=[A-Z]|$)/.test(text)) return new Error(`Empty AND clause in derived query '${methodName}'.`);
        if (!text || text.startsWith('OrderBy')) {
            if (previousKeyword === 'By') return new Error(`A derived query must include at least one property after 'By' in '${methodName}'.`);
            return new Error(`Empty ${previousKeyword === 'Or' ? 'OR' : 'AND'} clause in derived query '${methodName}'.`);
        }
        if (/^Or(?=[A-Z]|$)/.test(text)) return new Error(`Empty OR clause in derived query '${methodName}'.`);

        return new Error(`Cannot parse '${this.segmentAt(text, /(?:And|Or)(?=[A-Z]|$)/)}' in derived query '${methodName}'.`);
    }

    /** Reads the order fields that start at `position`, with the same longest-match strategy as the predicates. */
    private parseOrder(context: ParseContext, position: number, previousKeyword: 'OrderBy' | 'And'): ParsedMethod['order'] {
        const { body, methodName, columns } = context;
        let firstError: Error | undefined;

        if (position === body.length) {
            if (previousKeyword === 'OrderBy') throw new Error(`OrderBy in '${methodName}' must be followed by at least one property.`);
            throw new Error(`Empty order field in derived query '${methodName}'.`);
        }

        for (const { propertyPath, tag } of columns.filter(({ tag }) => body.startsWith(tag, position))) {
            const directionPosition = position + tag.length;
            for (const direction of ['Desc', 'Asc', ''] as const) {
                if (!body.startsWith(direction, directionPosition)) continue;

                const field = { propertyPath, direction: direction === 'Desc' ? ('DESC' as const) : ('ASC' as const) };
                const end = directionPosition + direction.length;
                if (end === body.length) return [field];
                if (body.startsWith('OrderBy', end)) {
                    firstError ??= new Error(`Only one OrderBy clause is allowed in '${methodName}'.`);
                    continue;
                }
                if (!body.startsWith('And', end)) continue;

                try {
                    return [field, ...this.parseOrder(context, end + 'And'.length, 'And')];
                } catch (error) {
                    firstError ??= error as Error;
                }
            }
        }

        if (firstError) throw firstError;

        const text = body.slice(position);
        if (text.startsWith('OrderBy')) throw new Error(`Only one OrderBy clause is allowed in '${methodName}'.`);
        if (/^And(?=[A-Z]|$)/.test(text)) throw new Error(`Empty order field in derived query '${methodName}'.`);
        throw new Error(`Cannot parse order field '${this.segmentAt(text, /And(?=[A-Z]|$)/)}' in derived query '${methodName}'.`);
    }

    /** Returns the text before the next keyword, used to point at the part of the method name that cannot be parsed. */
    private segmentAt(text: string, keyword: RegExp): string {
        const match = keyword.exec(text.slice(1));
        return match ? text.slice(0, match.index + 1) : text;
    }
}

interface ParseContext {
    /** Method name without its prefix, such as `StatusAndAgeGreaterThan`. */
    body: string;
    /** Full method name, used in error messages. */
    methodName: string;
    /** Entity properties with their method name tags, longest tag first. */
    columns: { propertyPath: string; tag: string }[];
}

export interface PageRequest {
    /** Zero-based page index. */
    page: number;
    /** Number of entities to return per page. Must be greater than zero. */
    size: number;
}
