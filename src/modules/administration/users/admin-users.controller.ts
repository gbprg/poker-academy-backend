import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../../auth/jwt-auth.guard.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { AdminUsersService } from './admin-users.service.js';
import { InviteUserDto } from './invite-user.dto.js';

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

  @Post()
  async invite(@Req() request: AuthenticatedRequest, @Body() input: InviteUserDto) {
    const invitation = await this.users.invite(request.user.id, input);
    const activationUrl = new URL(
      '/ativar-conta',
      this.config.get<string>('FRONTEND_ORIGIN', 'http://localhost:5173'),
    );
    activationUrl.searchParams.set('token', invitation.activationToken);

    return {
      user: invitation.user,
      activationUrl: activationUrl.toString(),
      expiresAt: invitation.expiresAt,
    };
  }
}
