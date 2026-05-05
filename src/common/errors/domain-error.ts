export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(
    message: string,
    public readonly meta: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NoAvailabilityError extends DomainError {
  readonly code = 'NO_AVAILABILITY';
  readonly httpStatus = 422;
}

export class RequestNotFoundError extends DomainError {
  readonly code = 'REQUEST_NOT_FOUND';
  readonly httpStatus = 404;
}

export class RequestAlreadyConfirmedError extends DomainError {
  readonly code = 'REQUEST_ALREADY_CONFIRMED';
  readonly httpStatus = 409;
}

export class SafePointReasonRequiredError extends DomainError {
  readonly code = 'SAFE_POINT_REASON_REQUIRED';
  readonly httpStatus = 400;
}

export class RbacForbiddenError extends DomainError {
  readonly code = 'RBAC_FORBIDDEN';
  readonly httpStatus = 403;
}

export class DistanceProviderTimeoutError extends DomainError {
  readonly code = 'DISTANCE_PROVIDER_TIMEOUT';
  readonly httpStatus = 503;
}
