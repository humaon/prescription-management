import { NextFunction, Request, Response } from "express";
import { ServiceError } from "../lib/types";
import { createErrorResponse, logError } from "../lib/utils";

export function errorHandler(
  error: ServiceError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (!(error instanceof Error)) {
    console.error("Non-Error thrown:", error);
  }

  logError(error, {
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  const statusCode = error.statusCode || 500;
  const message =
    error?.message || (error as any)?.error?.message || "Internal Server Error";

  return res.status(statusCode).json(createErrorResponse(message));
}
