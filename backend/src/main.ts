import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import type { AppEnvironment } from "./config/env.validation";
import { configureApplication } from "./configure-application";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<AppEnvironment, true>);
  app.useLogger(new Logger("MrCleanApi"));
  const prefix = configureApplication(app);

  const port = config.get("PORT", { infer: true });
  await app.listen(port, "0.0.0.0");
  Logger.log(`Mr. Clean API listening on http://localhost:${port}/${prefix}`, "Bootstrap");
}

void bootstrap();
