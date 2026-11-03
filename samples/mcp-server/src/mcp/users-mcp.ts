import { Pipe, Timeout, ValidateSchema } from '@axisparkjs/engine';
import {
    McpArgs,
    McpClientInfo,
    McpContext,
    McpError,
    McpErrorCode,
    McpParam,
    McpPrompt,
    McpResource,
    McpResults,
    McpServer,
    McpSession,
    McpTool
} from '@axisparkjs/mcp';
import { CreateUserDto, SearchUsersDto, UserService, WelcomePromptDto } from './users';

@McpServer({ prefix: 'users' })
export class UsersMcp {
    constructor(private readonly users: UserService) {}

    @McpTool('search', { description: 'Search users by name', annotations: { readOnlyHint: true } })
    search(@McpArgs() @Pipe(ValidateSchema()) args: SearchUsersDto) {
        return { users: this.users.search(args.query, args.limit) };
    }

    @McpTool('create', { description: 'Create a user' })
    create(@McpArgs() @Pipe(ValidateSchema({ whitelist: true, forbidNonWhitelisted: true })) user: CreateUserDto) {
        return this.users.create(user);
    }

    @McpTool('count', { description: 'Count the users' })
    count() {
        return `There are ${this.users.findAll().length} users`;
    }

    @McpResource('users://all', { description: 'All the users', mimeType: 'application/json' })
    all() {
        return this.users.findAll();
    }

    @McpResource('users://{id}', { description: 'User profile', mimeType: 'application/json' })
    profile(@McpParam('id') id: string) {
        const user = this.users.findById(id);
        if (!user) throw new McpError(`User '${id}' not found`, McpErrorCode.InvalidParams);
        return user;
    }

    @McpPrompt('welcome', { description: 'Write a welcome message for a new user' })
    welcome(@McpArgs() args: WelcomePromptDto) {
        return `Write a ${args.tone ?? 'friendly'} welcome message for ${args.name}.`;
    }
}

@McpServer()
export class DiagnosticsMcp {
    @McpTool({ description: 'Return information about the current request' })
    whoami(@McpSession() session: McpSession, @McpContext() context: McpContext) {
        const client: McpClientInfo | undefined = context.client;
        return { transport: session.transport, tool: context.request.name, hasClient: client !== undefined };
    }

    @McpTool({ description: 'Return an image' })
    pixel() {
        return McpResults.Image(
            Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
            'image/png'
        );
    }

    @McpTool({ description: 'Always fail' })
    fail() {
        throw new Error('Something went wrong');
    }

    @McpTool({ description: 'Take longer than its timeout' })
    @Timeout(50)
    async slow() {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'done';
    }
}
