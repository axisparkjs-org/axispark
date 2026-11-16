import { PluginDependencyFailedError } from './plugin-dependency-failed-error';

describe('PluginDependencyFailedError', () => {
    it('should create an error with the correct name and message', () => {
        const error = new PluginDependencyFailedError('CachePlugin', 'RedisPlugin');

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(PluginDependencyFailedError);
        expect(error.name).toBe('PluginDependencyFailedError');
        expect(error.message).toBe('Plugin CachePlugin skipped because its dependency RedisPlugin failed');
    });
});
