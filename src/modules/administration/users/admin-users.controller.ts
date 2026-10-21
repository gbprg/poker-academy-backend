import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { AdminUsersService } from './admin-users.service.js';
import { InviteUserDto } from './invite-user.dto.js';
import { ResetAccessDto, UpdateUserDto } from './update-user.dto.js';

@ApiTags('admin-users')
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly config: ConfigService,
  ) {}

  private activationUrl(token: string): string {
    const url = new URL(
      '/ativar-conta',
      this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173'),
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  @Post()
  async invite(@Req() request: AuthenticatedRequest, @Body() input: InviteUserDto) {
    const invitation = await this.users.invite(request.user.id, input);
    return {
      user: invitation.user,
      activationUrl: this.activationUrl(invitation.activationToken),
      expiresAt: invitation.expiresAt,
    };
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list() {
    return this.users.list();
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateUserDto,
  ) {
    return this.users.update(request.user.id, id, input);
  }

  @Post(':id/reset-access')
  async resetAccess(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ResetAccessDto,
  ) {
    const reset = await this.users.resetAccess(request.user.id, id, input.expiresInHours);
    return {
      user: reset.user,
      activationUrl: this.activationUrl(reset.activationToken),
      expiresAt: reset.expiresAt,
    };
  }
}
