import { Controller, Get, Path } from '@axisparkjs/http';
import { UserService } from './user.service';

@Controller('v2/users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':id')
    getUser(@Path('id') id: string) {
        return { version: this.userService.version, user: this.userService.getUser(id) };
    }
}
