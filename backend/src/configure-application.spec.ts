import { describe, expect, it } from "vitest";
import { isCorsOriginAllowed } from "./configure-application";

describe("CORS origin policy", () => {
  const allowedOrigins = new Set([
    "https://mr-clean.example",
    "http://localhost:5173"
  ]);

  it("allows server-to-server requests and exact configured origins", () => {
    expect(isCorsOriginAllowed(undefined, allowedOrigins)).toBe(true);
    expect(isCorsOriginAllowed("https://mr-clean.example", allowedOrigins)).toBe(true);
  });

  it("denies lookalike and unconfigured origins without raising an application error", () => {
    expect(isCorsOriginAllowed("https://mr-clean.example.evil.test", allowedOrigins)).toBe(false);
    expect(isCorsOriginAllowed("https://evil.test", allowedOrigins)).toBe(false);
  });
});
