import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import type { AppEnvironment } from "./config/env.validation";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<AppEnvironment, true>);
  const prefix = config.get("API_PREFIX", { infer: true }).replace(/^\/+|\/+$/g, "");
  const allowedOrigins = new Set(
    config.get("CORS_ORIGINS", { infer: true })
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

  app.useLogger(new Logger("MrCleanApi"));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.enableCors({
    credentials: true,
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"), false);
    }
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true
    })
  );
  app.setGlobalPrefix(prefix);
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder()
    .setTitle("Mr. Clean API")
    .setDescription("Catalog, administration, uploads, and order APIs for Mr. Clean.")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, openApi);
  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    jsonDocumentUrl: `${prefix}/docs-json`
  });

  const port = config.get("PORT", { infer: true });
  await app.listen(port, "0.0.0.0");
  Logger.log(`Mr. Clean API listening on http://localhost:${port}/${prefix}`, "Bootstrap");
}

void bootstrap();
