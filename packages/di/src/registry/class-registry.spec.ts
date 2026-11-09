import { Metadata, MetadataKeys } from '@axisparkjs/common';
import { ClassRegistry } from './class-registry';

describe('ClassRegistry', () => {
    class TestClassA {}
    class TestClassB {}
    class TestClassC {}

    beforeEach(() => {
        jest.restoreAllMocks();

        // Clear the registry between tests
        ClassRegistry.getAll().forEach((cls) => ClassRegistry.remove(cls));
    });

    describe('register', () => {
        it('should register a class', () => {
            ClassRegistry.register(TestClassA);

            expect(ClassRegistry.has(TestClassA)).toBe(true);
            expect(ClassRegistry.getAll()).toEqual([TestClassA]);
        });

        it('should register only once the same class', () => {
            ClassRegistry.register(TestClassA);
            ClassRegistry.register(TestClassA);

            expect(ClassRegistry.getAll()).toEqual([TestClassA]);
        });

        it('should keep both classes when two different classes have the same name', () => {
            const createClass = () => class Duplicated {};
            const First = createClass();
            const Second = createClass();

            expect(First.name).toBe(Second.name);

            ClassRegistry.register(First);
            ClassRegistry.register(Second);

            expect(ClassRegistry.getAll()).toEqual([First, Second]);
        });
    });

    describe('remove', () => {
        it('should remove a registered class', () => {
            ClassRegistry.register(TestClassA);

            ClassRegistry.remove(TestClassA);

            expect(ClassRegistry.has(TestClassA)).toBe(false);
        });

        it('should do nothing when removing a non-registered class', () => {
            expect(() => ClassRegistry.remove(TestClassA)).not.toThrow();
        });

        it('should only remove the given class when another class has the same name', () => {
            const createClass = () => class Duplicated {};
            const First = createClass();
            const Second = createClass();

            ClassRegistry.register(First);
            ClassRegistry.register(Second);
            ClassRegistry.remove(First);

            expect(ClassRegistry.getAll()).toEqual([Second]);
        });
    });

    describe('has', () => {
        it('should return false for a class with the name of a registered class', () => {
            class Original {}
            class Other {}
            Object.defineProperty(Other, 'name', { value: Original.name });

            ClassRegistry.register(Original);

            expect(ClassRegistry.has(Other)).toBe(false);
        });
    });

    describe('getAllByName', () => {
        it('should return every registered class with the name', () => {
            const createClass = () => class Duplicated {};
            const First = createClass();
            const Second = createClass();

            ClassRegistry.register(First);
            ClassRegistry.register(TestClassA);
            ClassRegistry.register(Second);

            expect(ClassRegistry.getAllByName('Duplicated')).toEqual([First, Second]);
            expect(ClassRegistry.getAllByName(TestClassA.name)).toEqual([TestClassA]);
        });

        it('should return an empty array when no class has the name', () => {
            expect(ClassRegistry.getAllByName('UnknownClass')).toEqual([]);
        });
    });

    describe('getAll', () => {
        it('should return all registered classes', () => {
            ClassRegistry.register(TestClassA);
            ClassRegistry.register(TestClassB);

            expect(ClassRegistry.getAll()).toEqual(expect.arrayContaining([TestClassA, TestClassB]));
            expect(ClassRegistry.getAll()).toHaveLength(2);
        });

        it('should return an empty array when no classes are registered', () => {
            expect(ClassRegistry.getAll()).toEqual([]);
        });
    });

    describe('getWithMetadata', () => {
        it('should return only classes with the specified metadata', () => {
            const spy = jest.spyOn(Metadata, 'has').mockImplementation((_, target) => {
                return target === TestClassA || target === TestClassC;
            });

            ClassRegistry.register(TestClassA);
            ClassRegistry.register(TestClassB);
            ClassRegistry.register(TestClassC);

            const result = ClassRegistry.getWithMetadata(MetadataKeys.CONSTRUCTABLE);

            expect(result).toEqual([TestClassA, TestClassC]);

            expect(spy).toHaveBeenCalledTimes(3);
            expect(spy).toHaveBeenCalledWith(MetadataKeys.CONSTRUCTABLE, TestClassA);
            expect(spy).toHaveBeenCalledWith(MetadataKeys.CONSTRUCTABLE, TestClassB);
            expect(spy).toHaveBeenCalledWith(MetadataKeys.CONSTRUCTABLE, TestClassC);
        });

        it('should return an empty array when no class has the metadata', () => {
            jest.spyOn(Metadata, 'has').mockReturnValue(false);

            ClassRegistry.register(TestClassA);
            ClassRegistry.register(TestClassB);

            const result = ClassRegistry.getWithMetadata(MetadataKeys.CONSTRUCTABLE);

            expect(result).toEqual([]);
        });

        it('should return an empty array when no classes are registered', () => {
            const spy = jest.spyOn(Metadata, 'has');

            const result = ClassRegistry.getWithMetadata(MetadataKeys.CONSTRUCTABLE);

            expect(result).toEqual([]);
            expect(spy).not.toHaveBeenCalled();
        });
    });
});
