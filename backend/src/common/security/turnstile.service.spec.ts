import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppEnvironment } from "../../config/env.validation";
import { TurnstileService } from "./turnstile.service";

function service(enabled = true): TurnstileService {
  const values: Partial<AppEnvironment> = {
    TURNSTILE_ENABLED: enabled,
    TURNSTILE_SECRET_KEY: enabled ? "turnstile-secret-for-unit-tests" : "",
    TURNSTILE_EXPECTED_HOSTNAMES: "www.mrclean-ks.com"
  };
  const config = {
    get: vi.fn((key: keyof AppEnvironment) => values[key])
  } as unknown as ConfigService<AppEnvironment, true>;
  return new TurnstileService(config);
}

describe("TurnstileService", () => {
  afterEach(() => vi.restoreAllMocks());

  it("bypasses verification only when explicitly disabled", async () => {
    const request = vi.spyOn(globalThis, "fetch");
    await expect(service(false).verify(undefined)).resolves.toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  });

  it("requires a token when enabled", async () => {
    await expect(service().verify(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts only the expected checkout hostname and action", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      success: true,
      hostname: "www.mrclean-ks.com",
      action: "checkout"
    }), { status: 200 }));

    await expect(service().verify("valid-widget-token")).resolves.toBeUndefined();
  });

  it.each([
    { success: false, hostname: "www.mrclean-ks.com", action: "checkout" },
    { success: true, hostname: "attacker.example", action: "checkout" },
    { success: true, hostname: "www.mrclean-ks.com", action: "login" }
  ])("rejects invalid provider results", async (result) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(result), { status: 200 })
    );
    await expect(service().verify("invalid-widget-token"))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("retries transient failures once with the same provider idempotency key", async () => {
    const request = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        hostname: "www.mrclean-ks.com",
        action: "checkout"
      }), { status: 200 }));

    await service().verify("valid-widget-token");
    const firstBody = request.mock.calls[0][1]?.body;
    const secondBody = request.mock.calls[1][1]?.body;
    expect(typeof firstBody).toBe("string");
    expect(typeof secondBody).toBe("string");
    const first = JSON.parse(firstBody as string) as { idempotency_key: string };
    const second = JSON.parse(secondBody as string) as { idempotency_key: string };
    expect(first.idempotency_key).toBe(second.idempotency_key);
  });

  it("fails closed when the provider remains unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network unavailable"));
    await expect(service().verify("valid-widget-token"))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
