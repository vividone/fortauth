import {
  Controller,
  Get,
  Req,
  Res,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../decorators/public.decorator';
import { OAuthService } from './oauth.service';
import { FORTAUTH_OPTIONS } from '../constants';
import type { FortAuthOptions } from '../interfaces';
import type { Request, Response } from 'express';

@Controller('oauth')
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    @Inject(FORTAUTH_OPTIONS) private readonly options: FortAuthOptions,
  ) {}

  // ─── Google ────────────────────────────────────────────
  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.oauthService.handleCallback(
      req.user as any, req.ip, req.headers['user-agent'],
    );
    res.json(result);
  }

  // ─── GitHub ────────────────────────────────────────────
  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubLogin() {
    // Passport redirects to GitHub
  }

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.oauthService.handleCallback(
      req.user as any, req.ip, req.headers['user-agent'],
    );
    res.json(result);
  }
}
