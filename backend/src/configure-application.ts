import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { AppEnvironment } from "./config/env.validation";

export function configureApplication(app: INestApplication): string {
  const config = app.get(ConfigService<AppEnvironment, true>);
  const prefix = config.get("API_PREFIX", { infer: true }).replace(/^\/+|\/+$/g, "");
  const allowedOrigins = new Set(
    config.get("CORS_ORIGINS", { infer: true })
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
  const production = config.get("NODE_ENV", { infer: true }) === "production";

  app.use(helmet({
    contentSecurityPolicy: production ? {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"]
      }
    } : false,
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: production ? {
      maxAge: 63_072_000,
      includeSubDomains: true,
      preload: true
    } : false,
    referrerPolicy: { policy: "no-referrer" }
  }));
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

  if (config.get("SWAGGER_ENABLED", { infer: true })) {
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
  }

  return prefix;
}
