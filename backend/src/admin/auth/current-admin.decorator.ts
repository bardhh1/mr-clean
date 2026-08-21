import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AdminPrincipal } from "./auth.types";

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AdminPrincipal | undefined => {
    return context.switchToHttp().getRequest<Request>().admin;
  }
);
