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

            expect(ClassRegistry.get(TestClassA.name)).toBe(TestClassA);
        });

        it('should overwrite an existing class with the same name', () => {
            class Original {}
            class Replacement {}

            Object.defineProperty(Replacement, 'name', {
                value: Original.name
            });

            ClassRegistry.register(Original);
            ClassRegistry.register(Replacement);

            expect(ClassRegistry.get(Original.name)).toBe(Replacement);
        });
    });

    describe('remove', () => {
        it('should remove a registered class', () => {
            ClassRegistry.register(TestClassA);

            ClassRegistry.remove(TestClassA);

            expect(ClassRegistry.get(TestClassA.name)).toBeUndefined();
        });

        it('should do nothing when removing a non-registered class', () => {
            expect(() => ClassRegistry.remove(TestClassA)).not.toThrow();
        });
    });

    describe('get', () => {
        it('should return the registered class', () => {
            ClassRegistry.register(TestClassA);

            expect(ClassRegistry.get(TestClassA.name)).toBe(TestClassA);
        });

        it('should return undefined when the class is not registered', () => {
            expect(ClassRegistry.get('UnknownClass')).toBeUndefined();
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
