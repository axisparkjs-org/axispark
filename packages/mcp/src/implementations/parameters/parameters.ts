import { Injectable } from '@axisparkjs/di';
import { Parameter, ParameterDefinition, ParameterResolver } from '@axisparkjs/engine';
import { McpContext, McpParameter, McpSession } from '../../types';

/**
 * A parameter decorator for injecting the arguments of a tool or a prompt. Combine it with `@Pipe(ValidateSchema())` to validate them; the class of the parameter is also used to generate the tool input schema.
 * @returns A parameter decorator.
 */
export const McpArgs = () => Parameter(McpParameter.Args);
/**
 * A parameter decorator for injecting a variable of the URI template of a resource. Without a name, it injects every variable.
 * @param name The name of the variable, such as `id` in `users://{id}`.
 * @returns A parameter decorator.
 */
export const McpParam = (name?: string) => Parameter(McpParameter.Param, name);

@Injectable()
export class McpArgsResolver implements ParameterResolver<Record<string, unknown>> {
    resolve(context: McpContext) {
        return context.request.arguments;
    }
}
@Injectable()
export class McpParamResolver implements ParameterResolver<unknown> {
    resolve(context: McpContext, parameter: ParameterDefinition) {
        if (parameter.field === undefined) return context.request.params;
        return context.request.params[parameter.field];
    }
}
@Injectable()
export class McpSessionResolver implements ParameterResolver<McpSession> {
    resolve(context: McpContext) {
        return context.session;
    }
}
@Injectable()
export class McpContextResolver implements ParameterResolver<McpContext> {
    resolve(context: McpContext) {
        return context;
    }
}
