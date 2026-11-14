import { InjectDataSource } from '@axisparkjs/data';
import { Body, Controller, Delete, Get, Path, Post, Query } from '@axisparkjs/http';
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

    @Get('named')
    named(@Query('name') name: string) {
        return this.customers.findByNameContainingIgnoreCaseOrderByNameAsc(name);
    }

    @Get('other-status')
    otherStatus(@Query('status') status: string) {
        return this.customers.findByStatusNotOrderByNameAsc(status);
    }

    @Get('adults-by-email')
    adultsByEmail(@Query('prefix') prefix: string, @Query('age') age: string) {
        return this.customers.findByEmailStartingWithAndAgeGreaterThanEqualOrderByNameAsc(prefix, Number(age));
    }

    @Get('excluding')
    excluding(@Query('status') statuses: string | string[]) {
        return this.customers.findByStatusNotInOrderByNameAsc(([] as string[]).concat(statuses ?? []));
    }

    @Get('by-id/:id')
    async findById(@Path('id') id: string) {
        return { customer: await this.customers.findById(id), exists: await this.customers.existsById(id) };
    }

    @Get('by-ids')
    findByIds(@Query('id') ids: string | string[]) {
        return this.customers.findByIds(([] as string[]).concat(ids ?? []));
    }

    // POST instead of DELETE, so the response includes the number of deleted customers (DELETE answers 204 without a body).
    @Post('by-id/:id/delete')
    async deleteById(@Path('id') id: string) {
        return { deleted: await this.customers.deleteById(id) };
    }

    @Post('delete-by-status')
    async deleteByStatus(@Query('status') status: string) {
        return { deleted: await this.customers.deleteByStatus(status) };
    }

    @Post('purge')
    purge(@Query('status') status: string, @Query('fail') fail?: string) {
        return this.registration.purge(status, fail === 'true');
    }

    @Get('all-pages')
    allPages(@Query('page') page: string, @Query('size') size: string) {
        return this.customers.findPage({ order: { name: 'ASC' } }, { page: Number(page), size: Number(size) });
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
