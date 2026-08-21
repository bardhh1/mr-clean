import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import type { AppEnvironment } from "../../config/env.validation";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { accessCookieName, refreshCookieName } from "./auth.constants";
import { CurrentAdmin } from "./current-admin.decorator";
import { LoginDto } from "./dto/login.dto";
import { TrustedClientGuard } from "./trusted-client.guard";
import type { AdminPrincipal } from "./auth.types";

@ApiTags("admin auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly config: ConfigService<AppEnvironment, true>
  ) {}

  @Post("login")
  @HttpCode(200)
  @UseGuards(TrustedClientGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Create an admin session" })
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(input.email, input.password);
    this.setSessionCookies(response, result);
    return { user: result.user };
  }

  @Post("refresh")
  @HttpCode(200)
  @UseGuards(TrustedClientGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Rotate the refresh session and access token" })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(this.readCookie(request, refreshCookieName) ?? "");
    this.setSessionCookies(response, result);
    return { user: result.user };
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(TrustedClientGuard)
  @ApiOperation({ summary: "Revoke the current refresh session" })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(this.readCookie(request, refreshCookieName));
    response.clearCookie(accessCookieName, this.cookieOptions("/"));
    response.clearCookie(refreshCookieName, this.cookieOptions(this.refreshCookiePath()));
  }

  @Get("me")
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: "Read the authenticated admin identity" })
  @ApiOkResponse({ description: "The active admin principal." })
  me(@CurrentAdmin() admin: AdminPrincipal | undefined) {
    return { user: admin };
  }

  private setSessionCookies(
    response: Response,
    result: {
      accessToken: string;
      refreshToken: string;
      accessTokenMaxAgeMs: number;
      refreshTokenMaxAgeMs: number;
    }
  ): void {
    response.cookie(accessCookieName, result.accessToken, {
      ...this.cookieOptions("/"),
      maxAge: result.accessTokenMaxAgeMs
    });
    response.cookie(refreshCookieName, result.refreshToken, {
      ...this.cookieOptions(this.refreshCookiePath()),
      maxAge: result.refreshTokenMaxAgeMs
    });
  }

  private refreshCookiePath(): string {
    const prefix = this.config.get("API_PREFIX", { infer: true }).replace(/^\/+|\/+$/g, "");
    return `/${prefix}/admin/auth`;
  }

  private cookieOptions(path: string): CookieOptions {
    return {
      httpOnly: true,
      path,
      sameSite: this.config.get("AUTH_COOKIE_SAME_SITE", { infer: true }),
      secure: this.config.get("AUTH_COOKIE_SECURE", { infer: true })
    };
  }

  private readCookie(request: Request, name: string): string | undefined {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    return cookies?.[name];
  }
}
