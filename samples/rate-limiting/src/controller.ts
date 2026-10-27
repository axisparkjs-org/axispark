import { Controller, Get } from '@axisparkjs/http';
import { NoRateLimit, RateLimit } from '@axisparkjs/engine';

@Controller('rate-limit')
export class RateLimitController {
    @Get('default')
    defaultLimit() {
        return { endpoint: 'default' };
    }

    @Get('override')
    @RateLimit({ limit: 1 })
    handlerOverride() {
        return { endpoint: 'override' };
    }

    @Get('excluded')
    @NoRateLimit()
    excluded() {
        return { endpoint: 'excluded' };
    }
}

@RateLimit({ limit: 1 })
@Controller('controller-rate-limit')
export class ControllerRateLimitController {
    @Get('inherited')
    inherited() {
        return { endpoint: 'inherited' };
    }

    @Get('override')
    @RateLimit({ limit: 2 })
    handlerOverride() {
        return { endpoint: 'handler-override' };
    }

    @Get('excluded')
    @NoRateLimit()
    excluded() {
        return { endpoint: 'controller-excluded' };
    }
}
