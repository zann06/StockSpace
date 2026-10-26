/** Application errors with an HTTP status — mapped to JSON by the error handler. */
export class AppError extends Error {
  readonly statusCode: number
  readonly code: string

  constructor(statusCode: number, code: string, message: string) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }

  static notFound(code: string, message: string): AppError {
    return new AppError(404, code, message)
  }

  static badRequest(code: string, message: string): AppError {
    return new AppError(400, code, message)
  }

  static conflict(code: string, message: string): AppError {
    return new AppError(409, code, message)
  }

  static unprocessable(code: string, message: string): AppError {
    return new AppError(422, code, message)
  }
}

export const ERRORS = {
  WORKSPACE_REQUIRED: 'WORKSPACE_REQUIRED',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  NOT_A_MEMBER: 'NOT_A_MEMBER',
  ROLE_FORBIDDEN: 'ROLE_FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  SKU_TAKEN: 'SKU_TAKEN',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  MEMBER_EXISTS: 'MEMBER_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  LAST_OWNER: 'LAST_OWNER',
  SELF_ROLE_CHANGE: 'SELF_ROLE_CHANGE',
  SELF_REMOVE: 'SELF_REMOVE',
  LOCATION_NOT_FOUND: 'LOCATION_NOT_FOUND',
  WAREHOUSE_NOT_FOUND: 'WAREHOUSE_NOT_FOUND',
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  SAME_SOURCE_AND_DESTINATION: 'SAME_SOURCE_AND_DESTINATION',
  REASON_REQUIRED: 'REASON_REQUIRED',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
} as const
