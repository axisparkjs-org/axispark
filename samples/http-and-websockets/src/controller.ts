import { Controller, Get, NotFoundError, Path } from '@axisparkjs/http';

@Controller('users')
export class UserController {
    @Get(':id')
    getUser(@Path('id') id: string) {
        if (id !== '1') throw new NotFoundError(`User ${id} not found`);
        return { id, name: 'Ada' };
    }

    @Get('fail/unexpected')
    fail() {
        throw new Error('Unexpected failure');
    }
}
