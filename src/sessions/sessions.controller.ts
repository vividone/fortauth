import {
  Controller,
  Get,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  async list(@CurrentUser('id') userId: string) {
    return this.sessionsService.list(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @CurrentUser('id') userId: string,
    @Param('id') sessionId: string,
  ) {
    await this.sessionsService.revoke(userId, sessionId);
    return { message: 'Session revoked' };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async revokeAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('sessionId') currentSessionId: string,
  ) {
    await this.sessionsService.revokeAll(userId, currentSessionId);
    return { message: 'All other sessions revoked' };
  }
}
