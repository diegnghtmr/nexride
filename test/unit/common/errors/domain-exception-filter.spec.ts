import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import {
  DomainError,
  NoAvailabilityError,
  RequestNotFoundError,
  RequestAlreadyConfirmedError,
  SafePointReasonRequiredError,
  RbacForbiddenError,
  DistanceProviderTimeoutError,
  RequestNotAuthorizedError,
} from '../../../../src/common/errors/domain-error';
import { DomainExceptionFilter } from '../../../../src/common/filters/domain-exception.filter';

function makeHost(statusFn: jest.Mock, jsonFn: jest.Mock): ArgumentsHost {
  const response = {
    status: statusFn,
    json: jsonFn,
  };
  statusFn.mockReturnValue(response);

  const request = { correlationId: 'test-req-id' };

  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
}

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new DomainExceptionFilter();
    statusMock = jest.fn();
    jsonMock = jest.fn();
    host = makeHost(statusMock, jsonMock);
  });

  it('maps NoAvailabilityError to 422', () => {
    const err = new NoAvailabilityError('no vehicles available');

    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NO_AVAILABILITY', message: 'no vehicles available' }),
    );
  });

  it('maps RequestNotFoundError to 404', () => {
    const err = new RequestNotFoundError('request not found');

    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'REQUEST_NOT_FOUND' }));
  });

  it('maps RequestAlreadyConfirmedError to 409', () => {
    const err = new RequestAlreadyConfirmedError('already confirmed');

    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'REQUEST_ALREADY_CONFIRMED' }));
  });

  it('maps SafePointReasonRequiredError to 400', () => {
    const err = new SafePointReasonRequiredError('reason required');

    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'SAFE_POINT_REASON_REQUIRED' }));
  });

  it('maps RbacForbiddenError to 403', () => {
    const err = new RbacForbiddenError('forbidden');

    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'RBAC_FORBIDDEN' }));
  });

  it('maps DistanceProviderTimeoutError to 503', () => {
    const err = new DistanceProviderTimeoutError('provider timeout');

    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'DISTANCE_PROVIDER_TIMEOUT' }));
  });

  it('includes request_id from correlationId in response body', () => {
    const err = new NoAvailabilityError('no vehicles');

    filter.catch(err, host);

    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'test-req-id' }));
  });

  it('DomainError subclasses are instances of Error and DomainError', () => {
    const err = new NoAvailabilityError('test');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(DomainError);
    expect(err.code).toBe('NO_AVAILABILITY');
    expect(err.httpStatus).toBe(422);
  });

  // REQ-SEC-2 — TDD RED: RequestNotAuthorizedError shape and filter mapping
  it('RequestNotAuthorizedError has code REQUEST_NOT_AUTHORIZED and httpStatus 403', () => {
    const err = new RequestNotAuthorizedError('rider not authorized', { requestId: 'req-001', riderId: 'rider-002' });

    expect(err.code).toBe('REQUEST_NOT_AUTHORIZED');
    expect(err.httpStatus).toBe(403);
    expect(err).toBeInstanceOf(DomainError);
    expect(err).toBeInstanceOf(Error);
  });

  it('maps RequestNotAuthorizedError to HTTP 403 via DomainExceptionFilter', () => {
    const err = new RequestNotAuthorizedError('rider not authorized');

    filter.catch(err, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'REQUEST_NOT_AUTHORIZED', message: 'rider not authorized' }),
    );
  });
});
