import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentOrganization = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const activeOrganization = request.activeOrganization;
    return data && activeOrganization ? activeOrganization[data] : activeOrganization;
  },
);
