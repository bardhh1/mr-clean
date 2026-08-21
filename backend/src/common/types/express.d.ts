declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      admin?: import("../../admin/auth/auth.types").AdminPrincipal;
    }
  }
}

export {};
