import { Body, Controller, Post, UseGuards, Req, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequestRideDto } from './dto/request-ride.dto';
import { ConfirmRideDto } from './dto/confirm-ride.dto';
import { DispatchFacade } from '../dispatch/dispatch.facade';
import { TestContextGuard } from '../common/guards/test-context.guard';

interface AuthenticatedRequest {
  user?: { id: string; role: string };
}

@ApiTags('Rides')
@Controller('rides')
@UseGuards(TestContextGuard)
export class RiderController {
  constructor(private readonly dispatchFacade: DispatchFacade) {}

  @Post('request')
  @HttpCode(201)
  @ApiOperation({ summary: 'Request a ride — runs the dispatch evaluation pipeline' })
  @ApiResponse({ status: 201, description: 'Ride request evaluated and decision persisted' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Missing authentication context' })
  @ApiResponse({ status: 422, description: 'No available vehicle' })
  async requestRide(@Req() req: AuthenticatedRequest, @Body() dto: RequestRideDto) {
    const riderId = req.user!.id;
    return this.dispatchFacade.evaluate({
      riderId,
      origin: dto.origin,
      destination: dto.destination,
      correlationId: dto.correlationId,
    });
  }

  @Post('confirm')
  @HttpCode(201)
  @ApiOperation({ summary: 'Confirm a ride choice — creates the trip and emits events' })
  @ApiResponse({ status: 201, description: 'Trip created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 409, description: 'Request already confirmed' })
  async confirmRide(@Req() req: AuthenticatedRequest, @Body() dto: ConfirmRideDto) {
    const riderId = req.user!.id;
    return this.dispatchFacade.confirm({
      requestId: dto.requestId,
      riderId,
      choice: dto.choice,
    });
  }
}
