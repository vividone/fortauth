import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MfaService } from './mfa.service';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { MfaVerifyLoginDto } from '../dto/auth.dto';
import {
  EnableMfaDto,
  DisableMfaDto,
  RegenerateBackupCodesDto,
} from '../dto/mfa.dto';

@Controller('mfa')
export class MfaController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('setup')
  async setup(@CurrentUser('id') userId: string) {
    return this.mfaService.generateSecret(userId);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  async enable(
    @CurrentUser('id') userId: string,
    @Body() dto: EnableMfaDto,
  ) {
    await this.mfaService.enableMfa(userId, dto.code);
    return { message: 'MFA enabled successfully' };
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: MfaVerifyLoginDto, @Req() req: any) {
    const { sub: userId } = this.tokenService.verifyMfaToken(dto.mfaToken);

    // Try TOTP first, then backup code
    const isValid =
      (await this.mfaService.verifyTotp(userId, dto.code)) ||
      (await this.mfaService.verifyBackupCode(userId, dto.code));

    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    return this.authService.completeMfaLogin(userId, req.ip, req.headers['user-agent']);
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  async disable(
    @CurrentUser('id') userId: string,
    @Body() dto: DisableMfaDto,
  ) {
    await this.mfaService.disableMfa(userId, dto.password);
    return { message: 'MFA disabled' };
  }

  @Post('backup-codes')
  async regenerateBackupCodes(
    @CurrentUser('id') userId: string,
    @Body() dto: RegenerateBackupCodesDto,
  ) {
    const codes = await this.mfaService.regenerateBackupCodes(userId, dto.password);
    return { backupCodes: codes };
  }
}
