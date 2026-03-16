import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract the authenticated user (or a specific field) from the request.
 *
 * @example
 * getProfile(@CurrentUser() user: FortUser) { ... }
 * getEmail(@CurrentUser('email') email: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
