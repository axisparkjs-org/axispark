import { Body, Controller, Post } from '@axisparkjs/http';
import { Pipe, ValidateSchema } from '@axisparkjs/engine';
import { CreateUserDto, UserLike } from './user';

@Controller('users')
export class UserController {
    @Post()
    create(@Body() @Pipe(ValidateSchema()) user: CreateUserDto) {
        return { ...user, isDto: user instanceof CreateUserDto };
    }

    @Post('strict')
    createStrict(@Body() @Pipe(ValidateSchema({ whitelist: true, forbidNonWhitelisted: true })) user: CreateUserDto) {
        return user;
    }

    @Post('whitelisted')
    createWhitelisted(@Body() @Pipe(ValidateSchema({ whitelist: true })) user: CreateUserDto) {
        return user;
    }

    @Post('admin')
    createAdmin(@Body() @Pipe(ValidateSchema({ groups: ['admin'] })) user: CreateUserDto) {
        return user;
    }

    @Post('untyped')
    createUntyped(@Body() @Pipe(ValidateSchema()) user: UserLike) {
        return user;
    }
}
