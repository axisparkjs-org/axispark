import { MetadataKey } from './metadata-key';

/**
 * An object containing various metadata keys used throughout the application.
 */
export const MetadataKeys = {
    /* Common */
    DESIGN_PARAM_TYPES: new MetadataKey('design:paramtypes'),
    DESIGN_RETURN_TYPE: new MetadataKey('design:returntype'),
    DESIGN_TYPE: new MetadataKey('design:type'),

    /* Di */
    CONSTRUCTABLE: new MetadataKey('constructable'),
    INJECTABLE: new MetadataKey('injectable'),
    INJECTABLE_TOKEN: new MetadataKey('injectable-token'),
    INJECTABLE_SCOPE: new MetadataKey('injectable-scope'),
    INJECT: new MetadataKey('inject'),

    /* Core */
    PLUGIN: new MetadataKey('plugin'),

    /* Engine */
    PARAMETER: new MetadataKey('parameter'),
    PIPE: new MetadataKey('pipe'),
    USE: new MetadataKey('use'),
    STEP_TARGET: new MetadataKey('step-target'),
    STEP_METHOD: new MetadataKey('step-method'),
    TIMEOUT: new MetadataKey('timeout'),

    /* Http */
    CONTROLLER: new MetadataKey('controller'),
    ROUTE: new MetadataKey('route'),
    HTTP_CODE: new MetadataKey('http-code'),
    RATE_LIMIT: new MetadataKey('rate-limit'),
    FILE_UPLOAD: new MetadataKey('file-upload'),

    /* Schedule */
    SCHEDULER: new MetadataKey('scheduler'),
    JOB: new MetadataKey('job'),

    /* OpenApi */
    OPENAPI_RESPONSE: new MetadataKey('openapi-response'),
    OPENAPI_SCHEMA: new MetadataKey('openapi-schema'),
    OPENAPI_PROPERTY: new MetadataKey('openapi-property'),

    /* WebSockets */
    WEBSOCKET: new MetadataKey('websocket'),
    WEBSOCKET_EVENT: new MetadataKey('websocket-event'),

    /* Data */
    REPOSITORY: new MetadataKey('repository'),

    /* Security */
    SECURED: new MetadataKey('secured')
} as const;
