import { Controller, Get } from '@axisparkjs/http';
import { Context } from '@axisparkjs/engine';
import { Secured, SecurityContext } from '@axisparkjs/security';
import { Principal } from '../authenticators';
import { AdminPolicy } from '../policies';

@Controller('credentials')
export class CredentialsController {
    @Get('public')
    publicRoute() {
        return { access: 'public' };
    }

    @Get('me')
    @Secured({ policies: [] })
    me(@Context() context: SecurityContext<Principal>) {
        return { authenticator: context.authenticationMethod?.name, principal: context.data };
    }

    @Get('admin')
    @Secured({ policies: [AdminPolicy] })
    admin(@Context() context: SecurityContext<Principal>) {
        return { access: 'admin', id: context.data?.id };
    }
}
