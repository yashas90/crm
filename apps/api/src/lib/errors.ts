export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(message: string, code = "NOT_FOUND") {
  return new AppError(code, message, 404);
}

export function badRequest(message: string, details?: unknown, code = "BAD_REQUEST") {
  return new AppError(code, message, 400, details);
}

export function forbidden(message: string, code = "FORBIDDEN") {
  return new AppError(code, message, 403);
}

export function conflict(message: string, code = "CONFLICT") {
  return new AppError(code, message, 409);
}
