import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { DataSource, MoreThan, Repository } from "typeorm";
import type { AppEnvironment } from "../../config/env.validation";
import { AdminSessionEntity } from "../entities/admin-session.entity";
import { AdminUserEntity } from "../entities/admin-user.entity";
import type { AccessTokenPayload, AdminPrincipal } from "./auth.types";
import { verifyPassword } from "./password";

@Injectable()
export class AdminAuthService {
  constructor(
    @InjectRepository(AdminUserEntity)
    private readonly users: Repository<AdminUserEntity>,
    @InjectRepository(AdminSessionEntity)
    private readonly sessions: Repository<AdminSessionEntity>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnvironment, true>
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findOne({
      where: { email: email.trim().toLowerCase(), is_active: true }
    });

    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new UnauthorizedException("Email or password is incorrect");
    }

    const result = await this.dataSource.transaction(async (manager) => {
      user.last_login_at = new Date();
      await manager.getRepository(AdminUserEntity).save(user);
      return this.createSession(manager.getRepository(AdminSessionEntity), user);
    });

    return this.issueResult(user, result.session, result.refreshToken);
  }

  async refresh(refreshToken: string) {
    const parsed = this.parseRefreshToken(refreshToken);

    return this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(AdminSessionEntity);
      const session = await sessionRepository.findOne({
        where: { id: parsed.sessionId },
        relations: { user: true },
        lock: { mode: "pessimistic_write" }
      });

      if (!session || !session.user || !this.isSessionValid(session, parsed.secret)) {
        throw new UnauthorizedException("Refresh session is invalid or expired");
      }

      session.revoked_at = new Date();
      session.last_used_at = new Date();
      await sessionRepository.save(session);

      const rotated = await this.createSession(sessionRepository, session.user);
      return this.issueResult(session.user, rotated.session, rotated.refreshToken);
    });
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    try {
      const parsed = this.parseRefreshToken(refreshToken);
      const session = await this.sessions.findOneBy({ id: parsed.sessionId });
      if (session && this.matchesSecret(session.token_hash, parsed.secret)) {
        session.revoked_at = new Date();
        await this.sessions.save(session);
      }
    } catch {
      // Logout is deliberately idempotent and never discloses session existence.
    }
  }

  async verifyAccessToken(token: string): Promise<AdminPrincipal> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Access token is invalid or expired");
    }

    const session = await this.sessions.findOne({
      where: {
        id: payload.sid,
        admin_user_id: payload.sub,
        expires_at: MoreThan(new Date())
      },
      relations: { user: true }
    });

    if (!session || session.revoked_at || !session.user?.is_active) {
      throw new UnauthorizedException("Admin session is no longer active");
    }

    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      session_id: session.id
    };
  }

  private async createSession(repository: Repository<AdminSessionEntity>, user: AdminUserEntity) {
    const secret = randomBytes(48).toString("base64url");
    const days = this.config.get("REFRESH_TOKEN_TTL_DAYS", { infer: true });
    const session = repository.create({
      admin_user_id: user.id,
      token_hash: this.hashSecret(secret),
      expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      revoked_at: null,
      last_used_at: null
    });
    const saved = await repository.save(session);
    return { session: saved, refreshToken: `${saved.id}.${secret}` };
  }

  private issueResult(user: AdminUserEntity, session: AdminSessionEntity, refreshToken: string) {
    const expiresIn = this.config.get("JWT_ACCESS_TTL_SECONDS", { infer: true });
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: session.id
    };

    return {
      accessToken: this.jwt.sign(payload, { expiresIn }),
      refreshToken,
      accessTokenMaxAgeMs: expiresIn * 1000,
      refreshTokenMaxAgeMs: Math.max(0, session.expires_at.getTime() - Date.now()),
      user: { id: user.id, email: user.email, role: user.role }
    };
  }

  private parseRefreshToken(token: string) {
    const [sessionId, secret, ...rest] = token.split(".");
    if (!sessionId || !secret || rest.length > 0) {
      throw new UnauthorizedException("Refresh session is invalid");
    }
    return { sessionId, secret };
  }

  private isSessionValid(session: AdminSessionEntity, secret: string): boolean {
    return !session.revoked_at
      && session.expires_at.getTime() > Date.now()
      && Boolean(session.user?.is_active)
      && this.matchesSecret(session.token_hash, secret);
  }

  private matchesSecret(expectedHash: string, secret: string): boolean {
    const expected = Buffer.from(expectedHash, "hex");
    const actual = Buffer.from(this.hashSecret(secret), "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }
}
