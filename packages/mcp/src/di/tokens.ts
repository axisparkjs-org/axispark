import { InjectionToken } from '@axisparkjs/di';

/**
 * An injection token for the MCP plugin options.
 */
export const MCP_OPTIONS = new InjectionToken('MCP_OPTIONS');
/**
 * An injection token for the MCP logger.
 */
export const MCP_LOGGER = new InjectionToken('MCP_LOGGER');
/**
 * An injection token for the MCP definitions (tools, resources and prompts) generated from the scanned classes.
 */
export const MCP_DEFINITIONS = new InjectionToken('MCP_DEFINITIONS');
/**
 * An injection token for the `McpServerBuilder` that creates the protocol servers of the transport.
 */
export const MCP_SERVER = new InjectionToken('MCP_SERVER');
/**
 * An injection token for the active MCP transport.
 */
export const MCP_TRANSPORT = new InjectionToken('MCP_TRANSPORT');
