import { Injectable } from '@nestjs/common';
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
} from '../../common/events/event-payloads';

@Injectable()
export class DispatchAnalyticsHandler {
  constructor(
    @InjectRepository(AnalyticsEventEntity)
    private readonly analyticsRepo: Repository<AnalyticsEventEntity>,
    @InjectPinoLogger(DispatchAnalyticsHandler.name)
    private readonly logger: PinoLogger,
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
        riderId: riderId ?? null,
        payloadJson: (payload as Record<string, unknown>) ?? {},
      });
      await this.analyticsRepo.save(entity);
    } catch (err) {
      // Analytics must never fail the parent transaction
      this.logger.warn({ eventName, err }, 'Failed to persist analytics event');
    }
  }
}
