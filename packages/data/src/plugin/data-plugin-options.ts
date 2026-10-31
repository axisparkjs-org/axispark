import { PluginOptions } from '@axisparkjs/core';
import { DataSourceOptions } from 'typeorm';

/** A named TypeORM connection managed by {@link DataPlugin}. */
export interface DataSourceConfig {
    /** Name used to identify and inject this data source. */
    name: string;
    /** TypeORM connection and driver options passed to `new DataSource(options)`. */
    options: DataSourceOptions;
}

/** Configuration passed to {@link DataPlugin} when registering it with the application. */
export interface DataPluginOptions extends PluginOptions {
    /**
     * Named TypeORM data sources to initialize during plugin registration.
     *
     * Every entity used by a `@Repository` repository must be included in one of
     * these data sources' `options.entities` arrays. A repository is associated
     * with the first configured source whose metadata contains that entity.
     */
    dataSources: DataSourceConfig[];

    /**
     * Whether a health check is registered in the `HealthEngine` for each data source. Defaults to `true`.
     */
    healthChecks?: boolean;
}
