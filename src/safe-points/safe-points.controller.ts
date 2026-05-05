import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TestContextGuard, RequiredRoles } from '../common/guards/test-context.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { SafePointsService } from './safe-points.service';
import { CreateSafePointDto } from './dto/create-safe-point.dto';
import { UpdateSafePointDto } from './dto/update-safe-point.dto';
import { FindWithinQueryDto } from './dto/find-within-query.dto';
import { SafePoint } from '../common/interfaces/shared-types';

type AuthenticatedRequest = Request & { user?: { id: string; role: string } };

/**
 * SafePointsController — REST endpoints for the SafePoints module.
 *
 * RBAC rules (design §6):
 * - POST / PATCH / DELETE: supervisor | administrador only
 * - GET /safe-points/within: any authenticated user (no RequiredRoles)
 *
 * TestContextGuard handles authentication (injects req.user from headers).
 * RbacGuard enforces roles based on @RequiredRoles() decorator metadata.
 */
@UseGuards(TestContextGuard, RbacGuard)
@Controller('safe-points')
export class SafePointsController {
  constructor(private readonly safePointsService: SafePointsService) {}

  @Get('within')
  async findWithin(@Query() query: FindWithinQueryDto): Promise<SafePoint[]> {
    return this.safePointsService.findWithin({ lat: query.lat, lng: query.lng }, query.radiusM ?? 120);
  }

  @Post()
  @RequiredRoles('supervisor', 'administrador')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSafePointDto, @Req() req: AuthenticatedRequest): Promise<SafePoint> {
    const actorId = req.user?.id ?? 'unknown';
    return this.safePointsService.create({
      name: dto.name,
      zoneId: dto.zoneId,
      reason: dto.reason,
      safetyScore: dto.safetyScore,
      location: dto.location,
      createdBy: actorId,
    });
  }

  @Patch(':id')
  @RequiredRoles('supervisor', 'administrador')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSafePointDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SafePoint> {
    const actorId = req.user?.id ?? 'unknown';
    return this.safePointsService.update(id, {
      name: dto.name,
      zoneId: dto.zoneId,
      safetyScore: dto.safetyScore,
      status: dto.status,
      location: dto.location,
      reason: dto.reason,
      updatedBy: actorId,
    });
  }

  @Delete(':id')
  @RequiredRoles('supervisor', 'administrador')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Query('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const actorId = req.user?.id ?? 'unknown';
    return this.safePointsService.delete(id, reason, actorId);
  }
}
