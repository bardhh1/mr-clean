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
};
