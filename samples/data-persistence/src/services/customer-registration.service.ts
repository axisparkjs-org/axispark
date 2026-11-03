import { TransactionManager, Transactional } from '@axisparkjs/data';
import { Injectable } from '@axisparkjs/di';
import { ConflictError } from '@axisparkjs/http';
import { Customer } from '../entities/customer';
import { CustomerRepository } from '../repositories/customer.repository';

export interface RegistrationResult {
    registered: number;
    active: number;
}

@Injectable()
export class CustomerRegistrationService {
    constructor(
        private readonly customers: CustomerRepository,
        private readonly transactionManager: TransactionManager
    ) {}

    /** Registers the customers in one transaction. The nested `registerOne` calls join it. */
    @Transactional({ dataSource: 'PRIMARY' })
    async register(customers: Customer[], fail: boolean): Promise<RegistrationResult> {
        for (const customer of customers) await this.registerOne(customer);
        return this.complete(customers, fail);
    }

    @Transactional({ dataSource: 'PRIMARY', isolationLevel: 'READ COMMITTED' })
    async registerOne(customer: Customer): Promise<Customer> {
        return this.customers.save(customer);
    }

    /** Same as `register`, opening the transaction with the injected `TransactionManager`. */
    registerProgrammatically(customers: Customer[], fail: boolean): Promise<RegistrationResult> {
        return this.transactionManager.runInTransaction(
            async () => {
                await this.customers.save(customers);
                return this.complete(customers, fail);
            },
            { dataSource: 'PRIMARY' }
        );
    }

    private async complete(customers: Customer[], fail: boolean): Promise<RegistrationResult> {
        // Derived query methods join the transaction, so they see the rows saved above.
        const active = await this.customers.countByStatus('active');
        if (fail) throw new ConflictError(`Registration of ${customers.length} customer(s) failed after saving them.`);
        return { registered: customers.length, active };
    }
}
