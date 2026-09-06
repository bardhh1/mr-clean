import { readFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const globalRule = config.headers?.find((rule) => rule.source === "/(.*)");
if (!globalRule) throw new Error("vercel.json must define a global response-header rule");

const headers = new Map(globalRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
const expectedHeaders = new Map([
  ["x-frame-options", "DENY"],
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "no-referrer"],
  ["permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()"],
  ["strict-transport-security", "max-age=63072000; includeSubDomains; preload"]
]);

for (const [name, expected] of expectedHeaders) {
  if (headers.get(name) !== expected) {
    throw new Error(`vercel.json must set ${name} to ${expected}`);
  }
}

const contentSecurityPolicy = headers.get("content-security-policy") ?? "";
for (const directive of [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "connect-src 'self' https://mr-clean-api-production.up.railway.app",
  "upgrade-insecure-requests"
]) {
  if (!contentSecurityPolicy.split(";").map((value) => value.trim()).includes(directive)) {
    throw new Error(`Content-Security-Policy is missing: ${directive}`);
  }
}

process.stdout.write("Vercel security-header contract passed.\n");
