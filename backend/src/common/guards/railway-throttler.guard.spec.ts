import { describe, expect, it } from "vitest";
import { requestTracker } from "./railway-throttler.guard";

describe("Railway request tracker", () => {
  it("uses Railway's normalized client IP before proxy addresses", () => {
    expect(requestTracker({
      headers: { "x-real-ip": "203.0.113.24" },
      ip: "100.64.0.10"
    })).toBe("203.0.113.24");
  });

  it("falls back to Express and socket addresses outside Railway", () => {
    expect(requestTracker({ headers: {}, ip: "127.0.0.1" })).toBe("127.0.0.1");
    expect(requestTracker({ socket: { remoteAddress: "::1" } })).toBe("::1");
  });

  it("normalizes array headers and safely handles malformed request shapes", () => {
    expect(requestTracker({
      headers: { "x-real-ip": [" 198.51.100.8 "] }
    })).toBe("198.51.100.8");
    expect(requestTracker({ headers: { "x-real-ip": "   " }, socket: null }))
      .toBe("unknown");
    expect(requestTracker({ headers: "invalid", socket: {} })).toBe("unknown");
  });
});
