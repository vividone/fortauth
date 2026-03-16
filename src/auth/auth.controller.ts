import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { BruteForceGuard } from '../rate-limiting/brute-force.guard';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from '../dto/auth.dto';

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.authService.register(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @UseGuards(BruteForceGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: string) {
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset successfully' };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.email, dto.otp);
    return { message: 'Email verified successfully' };
  }

  @Get('me')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, dto);
  }

  @Post('me/password/request-otp')
  @HttpCode(HttpStatus.OK)
  async requestPasswordChangeOtp(@CurrentUser('id') userId: string) {
    await this.authService.requestPasswordChangeOtp(userId);
    return { message: 'OTP sent to your email' };
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      dto.otp,
    );
    return { message: 'Password changed successfully' };
  }
}
