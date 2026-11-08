import { WebSocketPluginOptionsFactory } from './websocket-plugin-options-factory';

describe('WebSocketPluginOptionsFactory', () => {
    it('creates defaults and applies overrides', () => {
        expect(WebSocketPluginOptionsFactory.create()).toMatchObject({
            connectTimeout: 5000,
            path: '/websocket',
            serveClient: true,
            useHttpPluginServer: false,
            port: 3000,
            timeout: false,
            timeoutOptions: { time: 5000 }
        });
        expect(WebSocketPluginOptionsFactory.create({ port: 9, path: '/custom' })).toMatchObject({ port: 9, path: '/custom' });
    });
    it('merges the timeout options with the default time', () => {
        expect(WebSocketPluginOptionsFactory.create({ timeout: true, timeoutOptions: { message: 'Too slow' } })).toMatchObject({
            timeout: true,
            timeoutOptions: { time: 5000, message: 'Too slow' }
        });
        expect(WebSocketPluginOptionsFactory.create({ timeoutOptions: { time: 100 } }).timeoutOptions).toEqual({ time: 100 });
    });
});
