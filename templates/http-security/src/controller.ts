import { Controller, Get } from '@axisparkjs/http';
import { Secured } from '@axisparkjs/security';
import { AdminPolicy } from './policies';

@Controller('access')
export class AccessController {
    @Get('public')
    publicRoute() {
        return { access: 'public' };
    }

    @Get('admin')
    @Secured({ policies: [AdminPolicy] })
    adminRoute() {
        return { access: 'admin' };
    }
}
