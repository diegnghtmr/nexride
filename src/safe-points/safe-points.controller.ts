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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { TestContextGuard, RequiredRoles } from '../common/guards/test-context.guard';
import { RbacGuard } from '../common/guards/rbac.guard';
import { SafePointsService } from './safe-points.service';
import { CreateSafePointDto } from './dto/create-safe-point.dto';
import { UpdateSafePointDto } from './dto/update-safe-point.dto';
import { ActivateSafePointDto } from './dto/activate-safe-point.dto';
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
@ApiTags('safe-points')
@UseGuards(TestContextGuard, RbacGuard)
@Controller('safe-points')
export class SafePointsController {
  constructor(private readonly safePointsService: SafePointsService) {}

  @Get('within')
  @ApiOperation({ summary: 'Find safe points within a radius' })
  @ApiResponse({ status: 200, description: 'List of safe points within radius' })
  async findWithin(@Query() query: FindWithinQueryDto): Promise<SafePoint[]> {
    return this.safePointsService.findWithin({ lat: query.lat, lng: query.lng }, query.radiusM ?? 120);
  }

  @Post()
  @RequiredRoles('supervisor', 'administrador')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a safe point' })
  @ApiResponse({ status: 201, description: 'Safe point created' })
  @ApiResponse({ status: 403, description: 'Forbidden — role must be supervisor or administrador' })
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

  /**
   * F5 (v0.1.12-mvp): dedicated PATCH /:id/activate — MUST be declared before PATCH /:id
   * to prevent Express/Nest from interpreting ':id' as '<uuid>/activate'.
   */
  @Patch(':id/activate')
  @RequiredRoles('supervisor', 'administrador')
  @ApiOperation({ summary: 'Activate a safe point (writes ACTIVATE audit row, requires reason)' })
  @ApiResponse({ status: 200, description: 'Safe point activated' })
  @ApiResponse({ status: 400, description: 'Missing or empty reason' })
  @ApiResponse({ status: 403, description: 'Forbidden — supervisor or administrador only' })
  @ApiResponse({ status: 404, description: 'Safe point not found' })
  async activate(
    @Param('id') id: string,
    @Body() dto: ActivateSafePointDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SafePoint> {
    const actorId = req.user?.id ?? 'unknown';
    return this.safePointsService.activate(id, dto.reason, actorId);
  }

  /**
   * F5 (v0.1.12-mvp): dedicated PATCH /:id/deactivate — MUST be declared before PATCH /:id
   * to prevent Express/Nest from interpreting ':id' as '<uuid>/deactivate'.
   */
  @Patch(':id/deactivate')
  @RequiredRoles('supervisor', 'administrador')
  @ApiOperation({ summary: 'Deactivate a safe point (writes DEACTIVATE audit row, requires reason)' })
  @ApiResponse({ status: 200, description: 'Safe point deactivated' })
  @ApiResponse({ status: 400, description: 'Missing or empty reason' })
  @ApiResponse({ status: 403, description: 'Forbidden — supervisor or administrador only' })
  @ApiResponse({ status: 404, description: 'Safe point not found' })
  async deactivate(
    @Param('id') id: string,
    @Body() dto: ActivateSafePointDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SafePoint> {
    const actorId = req.user?.id ?? 'unknown';
    return this.safePointsService.deactivate(id, dto.reason, actorId);
  }

  @Patch(':id')
  @RequiredRoles('supervisor', 'administrador')
  @ApiOperation({ summary: 'Update a safe point (requires auditReason for audit trail)' })
  @ApiResponse({ status: 200, description: 'Safe point updated' })
  @ApiResponse({ status: 400, description: 'Missing auditReason or invalid input' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
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
      reason: dto.reason, // catalog reason (optional)
      auditReason: dto.auditReason, // audit reason (mandatory)
      updatedBy: actorId,
    });
  }

  @Delete(':id')
  @RequiredRoles('supervisor', 'administrador')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a safe point (requires reason for audit)' })
  @ApiResponse({ status: 204, description: 'Safe point deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async delete(
    @Param('id') id: string,
    @Query('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const actorId = req.user?.id ?? 'unknown';
    return this.safePointsService.delete(id, reason, actorId);
  }
}
