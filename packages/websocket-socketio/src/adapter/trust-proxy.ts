import proxyaddr from 'proxy-addr';
import type { WebSocketPluginOptions } from '@axisparkjs/websocket';

type TrustProxyOption = NonNullable<WebSocketPluginOptions['trustProxy']>;

/** A function that decides whether the proxy with an address, at a position of the `X-Forwarded-For` chain, is trusted. */
export type TrustProxyFunction = (address: string, index: number) => boolean;

/**
 * Compiles the `trustProxy` option with the same rules as the `trust proxy` setting of Express, which is used by the HTTP plugin.
 * @param option The trusted proxies. `false` or `undefined` trusts no proxy.
 * @returns The trust function, or undefined when no proxy is trusted.
 */
export function compileTrustProxy(option: TrustProxyOption | undefined): TrustProxyFunction | undefined {
    if (option === undefined || option === false) return undefined;
    if (option === true) return () => true;
    if (typeof option === 'number') return (_address, index) => index < option;

    const values = typeof option === 'string' ? option.split(',').map((value) => value.trim()) : option;
    return proxyaddr.compile(values);
}

/**
 * Resolves the address of a client from the address of its socket and the `X-Forwarded-For` header of its handshake.
 * @param address The address of the socket.
 * @param headers The headers of the handshake.
 * @param trust The trust function, or undefined when no proxy is trusted.
 * @returns The address of the client.
 */
export function resolveClientAddress(
    address: string | undefined,
    headers: Record<string, string | string[] | undefined>,
    trust?: TrustProxyFunction
): string | undefined {
    if (!address || !trust) return address;
    return proxyaddr({ headers, socket: { remoteAddress: address } } as unknown as Parameters<typeof proxyaddr>[0], trust);
}
