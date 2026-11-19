import { ClassType } from '@axisparkjs/common';
import { Inject, InjectionToken, createTokenFactory } from '@axisparkjs/di';

/** Injection token for the Data options. */
export const DATA_OPTIONS = new InjectionToken('DATA_OPTIONS');
/** Injection token for the Data logger. */
export const DATA_LOGGER = new InjectionToken('DATA_LOGGER');

/** Returns the injection token of a repository class, the same instance for the same class (two classes with the same name have different tokens). */
export const dataRepositoryToken = createTokenFactory((repository: ClassType) => `DATA_REPOSITORY_${repository.name.toLocaleUpperCase()}`);

const dataSourceTokenByUpperCaseName = createTokenFactory((name: string) => `DATA_SOURCE_${name}`);
/** Returns the injection token of a named data source, the same instance for the same name (case-insensitive). */
export const dataSourceToken = (name: string) => dataSourceTokenByUpperCaseName(name.toLocaleUpperCase());

/**
 * Injects a generated repository by its decorated repository class.
 *
 * @example `constructor(@InjectRepository(UserRepository) users: UserRepository) {}`
 */
export const InjectRepository = (repository: ClassType) => Inject(dataRepositoryToken(repository));
/**
 * Injects a TypeORM data source by its configured name (case-insensitive for token lookup).
 *
 * @example `constructor(@InjectDataSource('PRIMARY') dataSource: DataSource) {}`
 */
export const InjectDataSource = (name: string) => Inject(dataSourceToken(name));
