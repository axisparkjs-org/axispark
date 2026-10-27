import { ClassRegistry, Injectable } from '@axisparkjs/di';
import { Generator, Metadata, MetadataKeys } from '@axisparkjs/common';
import { RepositoryDefinition } from './repository-definition';
import { DataSourceConnectionManager } from '../connections';
import { QueryEngine } from './query-engine';
import { RepositoryMetadata } from '../metadata/repository-metadata';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { ClassType } from '@axisparkjs/common';
import { BaseRepository } from './base-repository';

/** Builds generated repository implementations for all classes decorated with `@Repository`. */
@Injectable()
export class RepositoryGenerator implements Generator<RepositoryDefinition[]> {
    private readonly dataSources: Map<string, DataSource>;

    constructor(
        private readonly dataSourceConnectionManager: DataSourceConnectionManager,
        private readonly queryEngine: QueryEngine
    ) {
        this.dataSources = this.dataSourceConnectionManager.getAllConnections();
    }

    /** Returns repository definitions backed by the matching TypeORM data sources. */
    async generate(): Promise<RepositoryDefinition[]> {
        const repositories: RepositoryDefinition[] = [];
        const repositoriesClasses = ClassRegistry.getWithMetadata(MetadataKeys.REPOSITORY);
        for (const repoClass of repositoriesClasses) {
            const repoMetadata = Metadata.get<RepositoryMetadata>(MetadataKeys.REPOSITORY, repoClass) as RepositoryMetadata;
            const dataSoruceName = this.getDataSourceByEntityName(repoMetadata.entity.name);
            const dataSource = this.dataSources.get(dataSoruceName) as DataSource;
            const entityRepository: Repository<ObjectLiteral> =
                dataSource.options.type === 'mongodb' ? dataSource.getMongoRepository(repoMetadata.entity) : dataSource.getRepository(repoMetadata.entity);
            const repositoryDefinition = new RepositoryDefinition(
                repoClass,
                repoMetadata.entity,
                dataSoruceName,
                this.generateImplementation(repoClass, [entityRepository, dataSource])
            );
            repositories.push(repositoryDefinition);
        }
        return repositories;
    }

    private generateImplementation(repository: ClassType, args: any[]): object {
        const target = Reflect.construct(repository, args) as BaseRepository<ObjectLiteral>;
        const queryEngine = this.queryEngine;

        return new Proxy(target, {
            get(object, property, receiver) {
                const value = Reflect.get(object, property, receiver);
                if (value !== undefined || Reflect.has(object, property)) return typeof value === 'function' ? value.bind(receiver) : value;

                // Promise resolution probes for `then`; never turn that probe into a query method.
                if (property === 'then') return undefined;

                if (typeof property === 'string' && /^(findOneBy|findBy|countBy|existsBy).+/.test(property)) {
                    return (...methodArgs: unknown[]) => queryEngine.execute(object, property, args, methodArgs);
                }

                return undefined;
            }
        });
    }

    private getDataSourceByEntityName(name: string): string {
        for (const [dataSourceName, dataSource] of this.dataSources.entries()) {
            const entityMetadata = dataSource.entityMetadatas.find((entity) => entity.name === name);
            if (entityMetadata) {
                return dataSourceName;
            }
        }

        throw new Error(`Entity '${name}' not found in any registered data source.`);
    }
}
