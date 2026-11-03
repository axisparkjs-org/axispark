import { InjectDataSource } from '@axisparkjs/data';
import { Body, Controller, Delete, Get, Post, Query } from '@axisparkjs/http';
import { DataSource, FindManyOptions } from 'typeorm';
import { Customer } from '../entities/customer';
import { CustomerRepository } from '../repositories/customer.repository';
import { CustomerRegistrationService } from '../services/customer-registration.service';

@Controller('customers')
export class CustomerController {
    constructor(
        private readonly customers: CustomerRepository,
        @InjectDataSource('PRIMARY') private readonly primaryDataSource: DataSource,
        private readonly registration: CustomerRegistrationService
    ) {}

    @Post()
    save(@Body() customers: Customer[]) {
        return this.customers.save(customers);
    }

    @Post('register')
    register(@Body() customers: Customer[], @Query('fail') fail?: string) {
        return this.registration.register(customers, fail === 'true');
    }

    @Post('register-programmatically')
    registerProgrammatically(@Body() customers: Customer[], @Query('fail') fail?: string) {
        return this.registration.registerProgrammatically(customers, fail === 'true');
    }

    @Get()
    find() {
        const options: FindManyOptions<Customer> = { order: { _id: 'ASC' } };
        return this.customers.find(options);
    }

    @Get('source')
    source() {
        return {
            initialized: this.primaryDataSource.isInitialized,
            database: this.primaryDataSource.options.database
        };
    }

    @Get('search')
    search(@Query('status') status: string, @Query('age') age: string, @Query('email') email: string) {
        return this.customers.findByStatusAndAgeGreaterThanOrEmailOrderByNameAsc(status, Number(age), email);
    }

    @Get('page')
    page(@Query('status') status: string, @Query('page') page: string, @Query('size') size: string) {
        return this.customers.findByStatusOrderByAgeDesc(status, { page: Number(page), size: Number(size) });
    }

    @Get('one')
    findOne(@Query('email') email: string) {
        return this.customers.findOneByEmail(email);
    }

    @Get('count')
    count(@Query('status') status: string) {
        return this.customers.countByStatus(status);
    }

    @Get('exists')
    exists(@Query('email') email: string) {
        return this.customers.existsByEmail(email);
    }

    @Delete('one')
    async removeOne(@Query('email') email: string) {
        const customer = await this.customers.findOneByEmail(email);
        if (!customer) return { removed: 0 };
        await this.customers.remove(customer);
        return { removed: 1 };
    }

    @Delete()
    async removeAll() {
        const customers = await this.customers.find();
        const removed = await this.customers.remove(customers);
        return { removed: removed.length };
    }
}
