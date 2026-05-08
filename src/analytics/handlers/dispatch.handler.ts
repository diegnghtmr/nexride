import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AnalyticsEventEntity } from '../infrastructure/analytics-event.entity';
import { DispatchEventName } from '../../common/events/event-names';
import {
  RequestCreatedPayload,
  SuggestionShownPayload,
  SuggestionAcceptedPayload,
  SuggestionRejectedPayload,
  FallbackActivatedPayload,
  CompletedPayload,
  TripAssignedPayload,
  NoAvailabilityPayload,
  CancelledPayload,
} from '../../common/events/event-payloads';
import { DISPATCH_METRICS } from '../../common/observability/observability.module';
import { DispatchMetrics } from '../../common/observability/metrics.registry';

@Injectable()
export class DispatchAnalyticsHandler {
  constructor(
    @InjectRepository(AnalyticsEventEntity)
    private readonly analyticsRepo: Repository<AnalyticsEventEntity>,
    @InjectPinoLogger(DispatchAnalyticsHandler.name)
    private readonly logger: PinoLogger,
    @Inject(DISPATCH_METRICS) private readonly metrics: DispatchMetrics,
  ) {}

  @OnEvent(DispatchEventName.RequestCreated, { async: true })
  async onRequestCreated(payload: RequestCreatedPayload): Promise<void> {
    await this.persist(
      DispatchEventName.RequestCreated,
      payload.requestId,
      undefined,
      payload.riderId,
      payload as unknown as Record<string, unknown>,
    );
  }

  @OnEvent(DispatchEventName.SuggestionShown, { async: true })
  async onSuggestionShown(payload: SuggestionShownPayload): Promise<void> {
    await this.persist(
      DispatchEventName.SuggestionShown,
      payload.requestId,
      undefined,
      payload.riderId,
      payload as unknown as Record<string, unknown>,
    );
  }

  @OnEvent(DispatchEventName.SuggestionAccepted, { async: true })
  async onSuggestionAccepted(payload: SuggestionAcceptedPayload): Promise<void> {
    await this.persist(
      DispatchEventName.SuggestionAccepted,
      payload.requestId,
      payload.tripId,
      payload.riderId,
      payload as unknown as Record<string, unknown>,
    );
  }

  @OnEvent(DispatchEventName.SuggestionRejected, { async: true })
  async onSuggestionRejected(payload: SuggestionRejectedPayload): Promise<void> {
    await this.persist(
      DispatchEventName.SuggestionRejected,
      payload.requestId,
      payload.tripId,
      payload.riderId,
      payload as unknown as Record<string, unknown>,
    );
  }

  @OnEvent(DispatchEventName.FallbackActivated, { async: true })
  async onFallbackActivated(payload: FallbackActivatedPayload): Promise<void> {
    await this.persist(
      DispatchEventName.FallbackActivated,
      payload.requestId,
      undefined,
      payload.riderId,
      payload as unknown as Record<string, unknown>,
    );
  }

  @OnEvent(DispatchEventName.Completed, { async: true })
  async onCompleted(payload: CompletedPayload): Promise<void> {
    await this.persist(
      DispatchEventName.Completed,
      payload.requestId,
      payload.tripId,
      payload.riderId,
      payload as unknown as Record<string, unknown>,
    );
  }

  @OnEvent(DispatchEventName.TripAssigned, { async: true })
  async onTripAssigned(payload: TripAssignedPayload): Promise<void> {
    await this.persist(
      DispatchEventName.TripAssigned,
      payload.requestId,
      payload.tripId,
      payload.riderId,
      payload as unknown as Record<string, unknown>,
    );
  }

  @OnEvent(DispatchEventName.NoAvailability, { async: true })
  async onNoAvailability(payload: NoAvailabilityPayload): Promise<void> {
    await this.persist(DispatchEventName.NoAvailability, payload.requestId, undefined, payload.riderId, {
      reason: payload.reason,
      ts: payload.ts,
    } as unknown as Record<string, unknown>);
  }

  /**
   * F2 (v0.1.12-mvp) — dispatch.cancelled scaffolding.
   * Persists an analytics row when a dispatch.cancelled event is received.
   * The emit site lives in the future cancellation use-case (RTF-26, post-MVP).
   * No dispatch_cancelled_total counter added per ADR-v11-04 (metrics-naming deferral).
   */
  @OnEvent(DispatchEventName.Cancelled, { async: true })
  async onCancelled(payload: CancelledPayload): Promise<void> {
    await this.persist(
      DispatchEventName.Cancelled,
      payload.requestId,
      payload.tripId,
      payload.riderId,
      payload as unknown as Record<string, unknown>,
    );
  }

  private async persist(
    eventName: string,
    requestId?: string,
    tripId?: string,
    riderId?: string,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const entity = this.analyticsRepo.create({
        eventName,
        requestId: requestId ?? null,
        tripId: tripId ?? null,
        // REQ-TRC-3: userId mapped from riderId — entity renamed to match TRD (F11).
        userId: riderId,
        metadata: (payload as Record<string, unknown>) ?? {},
      });
      await this.analyticsRepo.save(entity);
    } catch (err) {
      // Analytics must never fail the parent transaction
      // F7 — increment failure counter BEFORE warn so counter is always recorded
      this.metrics.analyticsPersistFailures.inc({ event_name: eventName });
      this.logger.warn({ eventName, err }, 'Failed to persist analytics event');
    }
  }
}
