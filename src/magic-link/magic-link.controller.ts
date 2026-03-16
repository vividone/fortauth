import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { MagicLinkService } from './magic-link.service';

@Controller('magic-link')
export class MagicLinkController {
  constructor(private readonly magicLinkService: MagicLinkService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async sendMagicLink(@Body('email') email: string) {
    await this.magicLinkService.sendMagicLink(email);
    return { message: 'If the email exists, a magic link has been sent' };
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body('token') token: string, @Req() req: any) {
    return this.magicLinkService.verify(token, req.ip, req.headers['user-agent']);
  }
}
