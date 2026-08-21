import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { trustedClientHeader, trustedClientValue } from "./auth.constants";

@Injectable()
export class TrustedClientGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.header(trustedClientHeader) !== trustedClientValue) {
      throw new UnauthorizedException("Trusted client header is required");
    }
    return true;
  }
}
