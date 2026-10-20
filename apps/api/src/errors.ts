import { toFieldErrors, type ApiErrorBody } from "@invoice/shared";
import type { ErrorRequestHandler, Response } from "express";
import type { ZodError } from "zod";

export type ErrorCode = ApiErrorBody["error"]["code"];
type FieldErrors = Record<string, string>;

/** An error that is safe to show to API clients, with the HTTP status to send it with. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fieldErrors: FieldErrors | undefined;

  constructor(status: number, code: ErrorCode, message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Invoice not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, fieldErrors?: FieldErrors) {
    super(409, "CONFLICT", message, fieldErrors);
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, fieldErrors?: FieldErrors, status = 422) {
    super(status, "VALIDATION_ERROR", message, fieldErrors);
  }

  static fromZod(error: ZodError): ValidationError {
    const fieldErrors = toFieldErrors(error);
    // An issue without a path means the body itself has the wrong shape (e.g. not an object).
    const message = fieldErrors[""] ?? "Some fields need attention";
    return new ValidationError(message, fieldErrors);
  }
}

export class EmailFailedError extends HttpError {
  constructor(message: string) {
    super(502, "EMAIL_FAILED", message);
  }
}

/**
 * body-parser and serve-static report client errors (bad JSON, missing file, …) as errors with a
 * 4xx `status`. Only the status is used: their messages may mention internal paths.
 */
function toClientError(error: unknown): HttpError | null {
  if (typeof error !== "object" || error === null) return null;
  const { status, type } = error as { status?: unknown; type?: unknown };
  if (typeof status !== "number" || status < 400 || status >= 500) return null;
  if (status === 404) return new NotFoundError("Not found");
  if (type === "entity.parse.failed") {
    return new ValidationError("The request body isn't valid JSON", undefined, 400);
  }
  if (type === "entity.too.large") {
    return new ValidationError("The request body is too large", undefined, status);
  }
  return new ValidationError("The request couldn't be processed", undefined, status);
}

function sendError(res: Response, error: HttpError): void {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
    },
  };
  res.status(error.status).json(body);
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof HttpError) return sendError(res, error);

  const clientError = toClientError(error);
  if (clientError) return sendError(res, clientError);

  console.error(error);
  sendError(
    res,
    new HttpError(500, "INTERNAL", "Something went wrong on our side. Please try again."),
  );
};
