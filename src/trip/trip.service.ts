import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ITripService } from '../common/interfaces/ITripService';
import { CreateTripInput, Trip } from '../common/interfaces/shared-types';
import { TripEntity } from './infrastructure/trip.entity';

@Injectable()
export class TripService implements ITripService {
  constructor(
    @InjectRepository(TripEntity)
    private readonly tripRepo: Repository<TripEntity>,
  ) {}

  async createMinimum(input: CreateTripInput): Promise<Trip> {
    const entity = this.tripRepo.create({
      requestId: input.requestId,
      riderId: input.riderId,
      vehicleId: input.vehicleId,
      pickupType: input.pickupType,
      suggestedPointId: input.suggestedPointId ?? null,
      pickupLat: input.pickupLocation.lat,
      pickupLng: input.pickupLocation.lng,
      destinationLat: input.destination.lat,
      destinationLng: input.destination.lng,
      status: 'assigned',
      assignedAt: new Date(),
    });

    const saved = await this.tripRepo.save(entity);

    return {
      id: saved.id,
      requestId: saved.requestId,
      riderId: saved.riderId,
      vehicleId: saved.vehicleId,
      pickupType: saved.pickupType,
      suggestedPointId: saved.suggestedPointId ?? undefined,
      pickupLocation: { lat: saved.pickupLat, lng: saved.pickupLng },
      destination: { lat: saved.destinationLat, lng: saved.destinationLng },
      status: saved.status,
      createdAt: saved.createdAt,
      assignedAt: saved.assignedAt,
    };
  }
}
