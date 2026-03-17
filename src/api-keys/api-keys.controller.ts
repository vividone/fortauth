import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from '../dto/api-key.dto';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    return this.apiKeysService.create(userId, dto.name, dto.scopes, expiresAt);
  }

  @Get()
  async list(@CurrentUser('id') userId: string) {
    return this.apiKeysService.list(userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) keyId: string,
  ) {
    await this.apiKeysService.revoke(userId, keyId);
    return { message: 'API key revoked' };
  }
}
