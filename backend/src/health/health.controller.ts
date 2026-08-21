import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Liveness probe" })
  @ApiOkResponse({ description: "The API process is accepting requests." })
  status() {
    return this.health.status();
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe" })
  @ApiOkResponse({ description: "The API and its required dependencies are available." })
  readiness() {
    return this.health.readiness();
  }
}
