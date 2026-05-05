import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripEntity } from './infrastructure/trip.entity';
import { TripService } from './trip.service';
import { TRIP_SERVICE } from '../common/interfaces/ITripService';

@Module({
  imports: [TypeOrmModule.forFeature([TripEntity])],
  providers: [
    TripService,
    {
      provide: TRIP_SERVICE,
      useExisting: TripService,
    },
  ],
  exports: [TRIP_SERVICE, TripService],
})
export class TripModule {}
