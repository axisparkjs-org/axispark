import { Controller, Get } from '@axisparkjs/http';

@Controller({ host: 'admin.example.test', path: 'users' })
export class AdminUsersController {
    @Get()
    index() {
        return { surface: 'admin' };
    }
}

@Controller({ host: 'api.example.test', path: 'users' })
export class ApiUsersController {
    @Get()
    index() {
        return { surface: 'api' };
    }
}

@Controller({ host: '*.wildcard.example.test', path: 'users' })
export class WildcardUsersController {
    @Get()
    index() {
        return { surface: 'wildcard' };
    }
}

@Controller({ host: ':tenant.named.example.test', path: 'users' })
export class NamedTenantUsersController {
    @Get()
    index() {
        return { surface: 'named-tenant' };
    }
}

@Controller('public')
export class PublicController {
    @Get()
    index() {
        return { surface: 'public' };
    }
}
