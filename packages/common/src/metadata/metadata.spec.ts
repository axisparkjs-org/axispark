import { Metadata } from './metadata';
import { MetadataKey } from './metadata-key';
import { MetadataKeys } from './metadata-keys';

describe('Metadata', () => {
    const testKey: MetadataKey = MetadataKeys.CONSTRUCTABLE;

    class TestClass {
        myMethod(): void {}
    }

    beforeEach(() => {
        jest.restoreAllMocks();
    });

    describe('define', () => {
        it('should call Reflect.defineMetadata with constructor when target is an instance', () => {
            const spy = jest.spyOn(Reflect, 'defineMetadata').mockImplementation();

            const value = { foo: 'bar' };
            const target = new TestClass();

            Metadata.define(testKey, value, target);

            expect(spy).toHaveBeenCalledWith(testKey.value, value, TestClass);
        });

        it('should call Reflect.defineMetadata with target when it is already a constructor', () => {
            const spy = jest.spyOn(Reflect, 'defineMetadata').mockImplementation();

            const value = { foo: 'bar' };

            Metadata.define(testKey, value, TestClass);

            expect(spy).toHaveBeenCalledWith(testKey.value, value, TestClass);
        });

        it('should call Reflect.defineMetadata with normalized target and method name', () => {
            const spy = jest.spyOn(Reflect, 'defineMetadata').mockImplementation();

            const value = { foo: 'bar' };
            const target = new TestClass();

            Metadata.define(testKey, value, target, 'myMethod');

            expect(spy).toHaveBeenCalledWith(testKey.value, value, TestClass, 'myMethod');
        });

        it('should use the target directly when normalizeTarget is false', () => {
            const spy = jest.spyOn(Reflect, 'defineMetadata').mockImplementation();

            const value = { foo: 'bar' };
            const target = new TestClass();

            Metadata.define(testKey, value, target, undefined, false);

            expect(spy).toHaveBeenCalledWith(testKey.value, value, target);
        });

        it('should use the target directly when normalizeTarget is false and propertyKey is provided', () => {
            const spy = jest.spyOn(Reflect, 'defineMetadata').mockImplementation();

            const value = { foo: 'bar' };
            const target = new TestClass();

            Metadata.define(testKey, value, target, 'myMethod', false);

            expect(spy).toHaveBeenCalledWith(testKey.value, value, target, 'myMethod');
        });

        it('should support symbol property keys', () => {
            const spy = jest.spyOn(Reflect, 'defineMetadata').mockImplementation();

            const value = { foo: 'bar' };
            const propertyKey = Symbol('myMethod');
            const target = new TestClass();

            Metadata.define(testKey, value, target, propertyKey);

            expect(spy).toHaveBeenCalledWith(testKey.value, value, TestClass, propertyKey);
        });

        it('should not normalize a constructor target', () => {
            const spy = jest.spyOn(Reflect, 'defineMetadata').mockImplementation();

            const value = { foo: 'bar' };

            Metadata.define(testKey, value, TestClass);

            expect(spy).toHaveBeenCalledWith(testKey.value, value, TestClass);
        });
    });

    describe('get', () => {
        it('should return metadata from Reflect.getMetadata', () => {
            const expected = { foo: 'bar' };
            const spy = jest.spyOn(Reflect, 'getMetadata').mockReturnValue(expected);

            const result = Metadata.get(testKey, new TestClass());

            expect(result).toBe(expected);
            expect(spy).toHaveBeenCalledWith(testKey.value, TestClass);
        });

        it('should return undefined when metadata does not exist', () => {
            jest.spyOn(Reflect, 'getMetadata').mockReturnValue(undefined);

            const result = Metadata.get(testKey, new TestClass());

            expect(result).toBeUndefined();
        });

        it('should return metadata from Reflect.getMetadata with method name', () => {
            const expected = { foo: 'bar' };
            const spy = jest.spyOn(Reflect, 'getMetadata').mockReturnValue(expected);

            const result = Metadata.get(testKey, new TestClass(), 'myMethod');

            expect(result).toBe(expected);
            expect(spy).toHaveBeenCalledWith(testKey.value, TestClass, 'myMethod');
        });

        it('should return undefined when metadata does not exist', () => {
            jest.spyOn(Reflect, 'getMetadata').mockReturnValue(undefined);

            const result = Metadata.get(testKey, new TestClass(), 'myMethod');

            expect(result).toBeUndefined();
        });

        it('should use the target directly when normalizeTarget is false', () => {
            const expected = { foo: 'bar' };
            const spy = jest.spyOn(Reflect, 'getMetadata').mockReturnValue(expected);

            const target = new TestClass();

            const result = Metadata.get(testKey, target, undefined, false);

            expect(result).toBe(expected);
            expect(spy).toHaveBeenCalledWith(testKey.value, target);
        });

        it('should use the target directly when normalizeTarget is false and propertyKey is provided', () => {
            const expected = { foo: 'bar' };
            const spy = jest.spyOn(Reflect, 'getMetadata').mockReturnValue(expected);

            const target = new TestClass();

            const result = Metadata.get(testKey, target, 'myMethod', false);

            expect(result).toBe(expected);
            expect(spy).toHaveBeenCalledWith(testKey.value, target, 'myMethod');
        });

        it('should support symbol property keys', () => {
            const expected = { foo: 'bar' };
            const propertyKey = Symbol('myMethod');
            const spy = jest.spyOn(Reflect, 'getMetadata').mockReturnValue(expected);

            const result = Metadata.get(testKey, new TestClass(), propertyKey);

            expect(result).toBe(expected);
            expect(spy).toHaveBeenCalledWith(testKey.value, TestClass, propertyKey);
        });

        it('should work with a constructor target and property name', () => {
            const expected = { foo: 'bar' };
            const spy = jest.spyOn(Reflect, 'getMetadata').mockReturnValue(expected);

            const result = Metadata.get(testKey, TestClass, 'myMethod');

            expect(result).toBe(expected);
            expect(spy).toHaveBeenCalledWith(testKey.value, TestClass, 'myMethod');
        });
    });

    describe('has', () => {
        it('should return true when metadata exists', () => {
            const spy = jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

            const result = Metadata.has(testKey, new TestClass());

            expect(result).toBe(true);
            expect(spy).toHaveBeenCalledWith(testKey.value, TestClass);
        });

        it('should return false when metadata does not exist', () => {
            jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(false);

            const result = Metadata.has(testKey, new TestClass());

            expect(result).toBe(false);
        });

        it('should return true when metadata exists for method', () => {
            const spy = jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

            const result = Metadata.has(testKey, new TestClass(), 'myMethod');

            expect(result).toBe(true);
            expect(spy).toHaveBeenCalledWith(testKey.value, TestClass, 'myMethod');
        });

        it('should return false when metadata does not exist for method', () => {
            jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(false);

            const result = Metadata.has(testKey, new TestClass(), 'myMethod');

            expect(result).toBe(false);
        });

        it('should use the target directly when normalizeTarget is false', () => {
            const spy = jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

            const target = new TestClass();

            const result = Metadata.has(testKey, target, undefined, false);

            expect(result).toBe(true);
            expect(spy).toHaveBeenCalledWith(testKey.value, target);
        });

        it('should use the target directly when normalizeTarget is false and propertyKey is provided', () => {
            const spy = jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

            const target = new TestClass();

            const result = Metadata.has(testKey, target, 'myMethod', false);

            expect(result).toBe(true);
            expect(spy).toHaveBeenCalledWith(testKey.value, target, 'myMethod');
        });

        it('should support symbol property keys', () => {
            const propertyKey = Symbol('myMethod');
            const spy = jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

            const result = Metadata.has(testKey, new TestClass(), propertyKey);

            expect(result).toBe(true);
            expect(spy).toHaveBeenCalledWith(testKey.value, TestClass, propertyKey);
        });

        it('should work with a constructor target and property name', () => {
            const spy = jest.spyOn(Reflect, 'hasMetadata').mockReturnValue(true);

            const result = Metadata.has(testKey, TestClass, 'myMethod');

            expect(result).toBe(true);
            expect(spy).toHaveBeenCalledWith(testKey.value, TestClass, 'myMethod');
        });
    });

    describe('normalizeTarget', () => {
        it('should return the constructor when target is an instance', () => {
            const target = new TestClass();

            expect(Metadata.normalizeTarget(target)).toBe(TestClass);
        });

        it('should return the target when target is already a constructor', () => {
            expect(Metadata.normalizeTarget(TestClass)).toBe(TestClass);
        });

        it('should return the same constructor reference', () => {
            const target = TestClass;

            expect(Metadata.normalizeTarget(target)).toBe(target);
        });
    });
    describe('version', () => {
        it('should change when metadata is defined on a class, not on a property', () => {
            class Versioned {
                method(): void {}
            }
            const key = new MetadataKey('version-test');
            const start = Metadata.version;

            Metadata.define(key, 1, Versioned, 'method');
            expect(Metadata.version).toBe(start);

            Metadata.define(key, 1, Versioned);
            expect(Metadata.version).toBe(start + 1);
        });
    });
});
