import { Module } from '@nestjs/common';
import { RiderController } from './rider.controller';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [DispatchModule],
  controllers: [RiderController],
})
export class RiderModule {}
