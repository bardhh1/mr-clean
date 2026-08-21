import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import type { ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = exception instanceof HttpException
      ? exception.getResponse()
      : "Internal server error";
    const message = typeof exceptionBody === "string"
      ? exceptionBody
      : (exceptionBody as { message?: string | string[] }).message ?? "Request failed";

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} failed`,
        exception instanceof Error ? exception.stack : String(exception)
      );
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? "Error",
      message,
      path: request.originalUrl,
      requestId: request.requestId,
      timestamp: new Date().toISOString()
    });
  }
}
