import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FleetService } from './fleet.service';
import { RedisFleetAdapter } from './infrastructure/redis-fleet.adapter';
import { FLEET_SERVICE } from '../common/interfaces/IFleetService';

/**
 * FleetModule — provides fleet read-side capabilities backed by Redis.
 *
 * Exports FleetService (via FLEET_SERVICE token) for use by DispatchModule.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    RedisFleetAdapter,
    FleetService,
    {
      provide: FLEET_SERVICE,
      useExisting: FleetService,
    },
  ],
  exports: [FleetService, FLEET_SERVICE],
})
export class FleetModule {}
