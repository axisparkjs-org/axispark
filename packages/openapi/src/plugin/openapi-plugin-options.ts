import { PluginOptions } from '@axisparkjs/core';

/**
 * Interface representing the options for configuring the OpenAPI plugin.
 */
export interface OpenApiPluginOptions extends PluginOptions {
    /**
     * Information about the API.
     */
    info: {
        title: string;
        version: string;
        description?: string;
        termsOfService?: string;
        contact?: {
            name?: string;
            url?: string;
            email?: string;
        };
        license?: {
            name: string;
            url?: string;
            identifier?: string;
        };
        summary?: string;
        externalDocs?: {
            description?: string;
            url: string;
        };
        tags?: {
            name: string;
            description?: string;
        }[];
        servers?: {
            url: string;
            description?: string;
        }[];
    };
    /**
     * If true, the OpenAPI plugin will use the global prefix for the documentation routes. If false, it will not use the global prefix.
     */
    globalPrefix?: boolean;
    /**
     * Url path for the OpenAPI documentation.
     */
    docsUrl?: string;
    /**
     * Url path for the OpenAPI JSON document.
     */
    jsonDocumentUrl?: string;
    /**
     * Url path for the OpenAPI YAML document.
     */
    yamlDocumentUrl?: string;
    /**
     * If true, the OpenAPI plugin will expose the JSON document as a REST endpoint.
     */
    exposeJson?: boolean;
    /**
     * If true, the OpenAPI plugin will expose the YAML document as a REST endpoint.
     */
    exposeYaml?: boolean;
    /**
     * If true, the JSON responses of the routes documented with `@OpenApiResponse()` are serialized with their schema by the HTTP adapters
     * that support it (Fastify, with `fast-json-stringify`), which is faster than `JSON.stringify`. The properties that are not in the schema
     * are not sent, so enable it only when the schemas describe every property of the responses. Defaults to false.
     */
    serializeResponses?: boolean;
}
