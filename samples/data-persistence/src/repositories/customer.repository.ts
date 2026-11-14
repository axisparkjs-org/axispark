import { Repository as DataRepository, BaseRepository, Page, PageRequest } from '@axisparkjs/data';
import { Customer } from '../entities/customer';

@DataRepository({ entity: Customer })
export class CustomerRepository extends BaseRepository<Customer> {
    declare findByStatusAndAgeGreaterThanOrEmailOrderByNameAsc: (status: string, age: number, email: string) => Promise<Customer[]>;

    // With a PageRequest, findBy methods resolve with a Page: the entities of the page and the totals.
    declare findByStatusOrderByAgeDesc: (status: string, page: PageRequest) => Promise<Page<Customer>>;

    declare findByNameContainingIgnoreCaseOrderByNameAsc: (name: string) => Promise<Customer[]>;

    declare findByStatusNotOrderByNameAsc: (status: string) => Promise<Customer[]>;

    declare findByEmailStartingWithAndAgeGreaterThanEqualOrderByNameAsc: (prefix: string, age: number) => Promise<Customer[]>;

    declare findByStatusNotInOrderByNameAsc: (statuses: string[]) => Promise<Customer[]>;

    declare deleteByStatus: (status: string) => Promise<number>;

    declare findOneByEmail: (email: string) => Promise<Customer | null>;

    declare countByStatus: (status: string) => Promise<number>;

    declare existsByEmail: (email: string) => Promise<boolean>;
}
