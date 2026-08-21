import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
export class RailwayThrottlerGuard extends ThrottlerGuard {
  protected getTracker(request: Record<string, unknown>): Promise<string> {
    return Promise.resolve(requestTracker(request));
  }
}

export function requestTracker(request: Record<string, unknown>): string {
  const headers = asRecord(request.headers);
  const railwayIp = firstHeader(headers?.["x-real-ip"]);
  if (railwayIp) return railwayIp;
  if (typeof request.ip === "string" && request.ip) return request.ip;

  const socket = asRecord(request.socket);
  return typeof socket?.remoteAddress === "string" && socket.remoteAddress
    ? socket.remoteAddress
    : "unknown";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : undefined;
}

function firstHeader(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0].trim() || undefined;
  }
  return undefined;
}
