import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() body: { name: string; scopes?: string[]; expiresAt?: string },
  ) {
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    return this.apiKeysService.create(userId, body.name, body.scopes, expiresAt);
  }

  @Get()
  async list(@CurrentUser('id') userId: string) {
    return this.apiKeysService.list(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @CurrentUser('id') userId: string,
    @Param('id') keyId: string,
  ) {
    await this.apiKeysService.revoke(userId, keyId);
    return { message: 'API key revoked' };
  }
}
