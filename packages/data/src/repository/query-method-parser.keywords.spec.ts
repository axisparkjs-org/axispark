import { ObjectLiteral, Repository } from 'typeorm';
import { QueryMethodParser, toPage, validatePageRequest } from './query-method-parser';

interface Product extends ObjectLiteral {
    id: number;
    name: string;
    status: string;
    active: boolean;
    notes: string;
    nameIgnoreCase: string;
}

describe('QueryMethodParser keywords', () => {
    const parser = new QueryMethodParser();
    const repository = (columns: string[]) =>
        ({ metadata: { columns: columns.map((propertyName) => ({ propertyName, propertyPath: propertyName })) } }) as unknown as Repository<Product>;
    const products = repository(['id', 'name', 'status', 'active', 'notes']);
    const predicate = (methodName: string, target = products) => parser.parse(target, methodName).predicateGroups[0][0];

    it.each([
        ['findByStatusNot', 'Not', 1],
        ['findByStatusNotIn', 'NotIn', 1],
        ['findByNameContaining', 'Containing', 1],
        ['findByNameStartingWith', 'StartingWith', 1],
        ['findByNameEndingWith', 'EndingWith', 1],
        ['findByActiveTrue', 'True', 0],
        ['findByActiveFalse', 'False', 0]
    ])('parses %s', (methodName, operator, arity) => {
        expect(predicate(methodName)).toEqual({
            propertyPath: methodName.startsWith('findByStatus') ? 'status' : methodName.startsWith('findByName') ? 'name' : 'active',
            operator,
            arity
        });
    });

    it.each([
        ['findByNameIgnoreCase', 'Equal'],
        ['findByNameNotIgnoreCase', 'Not'],
        ['findByNameLikeIgnoreCase', 'Like'],
        ['findByNameContainingIgnoreCase', 'Containing'],
        ['findByNameStartingWithIgnoreCase', 'StartingWith'],
        ['findByNameEndingWithIgnoreCase', 'EndingWith']
    ])('parses the IgnoreCase suffix of %s', (methodName, operator) => {
        expect(predicate(methodName)).toEqual({ propertyPath: 'name', operator, arity: 1, ignoreCase: true });
    });

    it('rejects IgnoreCase after operators that do not compare strings', () => {
        expect(() => parser.parse(products, 'findByStatusInIgnoreCase')).toThrow('Cannot parse');
    });

    it('combines the new keywords with And, Or and OrderBy', () => {
        expect(parser.parse(products, 'findByNameContainingIgnoreCaseAndActiveTrueOrStatusNotOrderByNameAsc')).toEqual({
            operation: 'findMany',
            predicateGroups: [
                [
                    { propertyPath: 'name', operator: 'Containing', arity: 1, ignoreCase: true },
                    { propertyPath: 'active', operator: 'True', arity: 0 }
                ],
                [{ propertyPath: 'status', operator: 'Not', arity: 1 }]
            ],
            order: [{ propertyPath: 'name', direction: 'ASC' }]
        });
    });

    it('matches property names before keywords', () => {
        expect(predicate('findByNotes')).toEqual({ propertyPath: 'notes', operator: 'Equal', arity: 1 });
        expect(predicate('findByNotesNot')).toEqual({ propertyPath: 'notes', operator: 'Not', arity: 1 });

        const withIgnoreCaseProperty = repository(['name', 'nameIgnoreCase']);
        expect(predicate('findByNameIgnoreCase', withIgnoreCaseProperty)).toEqual({ propertyPath: 'nameIgnoreCase', operator: 'Equal', arity: 1 });
        expect(predicate('findByNameIgnoreCaseIgnoreCase', withIgnoreCaseProperty)).toEqual({
            propertyPath: 'nameIgnoreCase',
            operator: 'Equal',
            arity: 1,
            ignoreCase: true
        });
    });

    it('parses deleteBy methods', () => {
        expect(parser.parse(products, 'deleteByStatus').operation).toBe('delete');
    });

    it('accepts page requests only in findBy methods', () => {
        expect(() => parser.extractPageRequest('delete', ['archived', { page: 0, size: 10 }])).toThrow('PageRequest is only supported by findBy methods.');
    });

    it('validates page requests', () => {
        expect(validatePageRequest({ page: 1, size: 20 })).toEqual({ page: 1, size: 20 });
        expect(() => validatePageRequest({ page: -1, size: 20 })).toThrow('non-negative integer page');
        expect(() => validatePageRequest({ page: 0, size: 0 })).toThrow('positive integer size');
    });

    it('builds pages with their totals', () => {
        expect(toPage(['a', 'b'], 5, { page: 1, size: 2 })).toEqual({ content: ['a', 'b'], page: 1, size: 2, totalElements: 5, totalPages: 3 });
        expect(toPage([], 0, { page: 0, size: 20 })).toEqual({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    });
});
