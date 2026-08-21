import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class HealthService {
  constructor(private readonly database: DataSource) {}

  status() {
    return {
      status: "ok",
      service: "mr-clean-api",
      version: process.env.npm_package_version ?? "0.1.0",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    };
  }

  async readiness() {
    await this.database.query("select 1");
    return {
      status: "ready",
      dependencies: { database: "up" },
      timestamp: new Date().toISOString()
    };
  }
}
