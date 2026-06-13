/** A thrown error the API layer turns into a clean JSON response. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }
  static conflict(message: string) {
    return new ApiError(409, message);
  }
}

/** Wraps an async route handler so thrown errors reach the error middleware. */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(fn: T) {
  return (req: any, res: any, next: any) => fn(req, res, next).catch(next);
}
