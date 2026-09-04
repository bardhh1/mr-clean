import type { AdminRole } from "../entities/admin-user.entity";

export type AdminPrincipal = {
  id: string;
  email: string;
  role: AdminRole;
  session_id: string;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: AdminRole;
  sid: string;
  ver: 2;
};

export type AdminSessionSummary = {
  id: string;
  current: boolean;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date;
  family_expires_at: Date;
};
