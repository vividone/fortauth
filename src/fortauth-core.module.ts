import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';

import { FORTAUTH_OPTIONS } from './constants';
import type { FortAuthOptions } from './interfaces';
import { FORT_ENTITIES } from './entities';

// Core services
import { AuthService } from './auth/auth.service';
import { TokenService } from './auth/token.service';
import { PasswordService } from './auth/password.service';
import { AuthController } from './auth/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

// Guards
import { FortAuthGuard } from './guards/fort-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';

// Feature modules (conditionally loaded)
import { SessionsService } from './sessions/sessions.service';
import { SessionsController } from './sessions/sessions.controller';
import { BruteForceService } from './rate-limiting/brute-force.service';
import { BruteForceGuard } from './rate-limiting/brute-force.guard';
import { MfaService } from './mfa/mfa.service';
import { MfaController } from './mfa/mfa.controller';
import { ApiKeysService } from './api-keys/api-keys.service';
import { ApiKeysController } from './api-keys/api-keys.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { OtpService } from './auth/otp.service';
import { MagicLinkService } from './magic-link/magic-link.service';
import { MagicLinkController } from './magic-link/magic-link.controller';
import { OAuthService } from './oauth/oauth.service';
import { OAuthController } from './oauth/oauth.controller';
import { FortAuthEventEmitter } from './events/fort-auth-event-emitter';

// Try to load optional OAuth strategies (deps may not be installed)
let GoogleStrategy: Type | undefined;
let GitHubStrategy: Type | undefined;
try { GoogleStrategy = require('./oauth/strategies/google.strategy').GoogleStrategy; } catch {}
try { GitHubStrategy = require('./oauth/strategies/github.strategy').GitHubStrategy; } catch {}

@Module({})
export class FortAuthCoreModule {
  static forRoot(options: FortAuthOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: FORTAUTH_OPTIONS, useValue: options },
      AuthService,
      TokenService,
      PasswordService,
      OtpService,
      JwtStrategy,
      SessionsService,
      BruteForceService,
      FortAuthEventEmitter,
    ];

    const controllers: Type[] = [AuthController, SessionsController];

    // MFA
    if (options.mfa?.enabled) {
      providers.push(MfaService);
      controllers.push(MfaController);
    }

    // API Keys
    if (options.apiKeys?.enabled) {
      providers.push(ApiKeysService);
      controllers.push(ApiKeysController);
    }

    // Global guards — ApiKeyGuard must run BEFORE FortAuthGuard
    // so that request.user is set before JWT validation runs
    if (options.enableGlobalGuard !== false) {
      if (options.apiKeys?.enabled) {
        providers.push({ provide: APP_GUARD, useClass: ApiKeyGuard });
      }
      providers.push(
        { provide: APP_GUARD, useClass: FortAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      );
    }

    // Magic Link
    if (options.magicLink?.enabled) {
      providers.push(MagicLinkService);
      controllers.push(MagicLinkController);
    }

    // OAuth
    if (options.oauth) {
      providers.push(OAuthService);
      controllers.push(OAuthController);

      if (options.oauth.google && GoogleStrategy) {
        providers.push(GoogleStrategy);
      }
      if (options.oauth.github && GitHubStrategy) {
        providers.push(GitHubStrategy);
      }
    }

    // Brute force guard on login
    providers.push(BruteForceGuard);

    return {
      module: FortAuthCoreModule,
      global: true,
      imports: [
        TypeOrmModule.forFeature([...FORT_ENTITIES]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: options.jwt.secret,
          signOptions: {
            expiresIn: (options.jwt.accessTokenExpiry || '15m') as any,
          },
        }),
      ],
      controllers,
      providers,
      exports: [
        FORTAUTH_OPTIONS,
        AuthService,
        TokenService,
        PasswordService,
        OtpService,
        SessionsService,
        BruteForceService,
        FortAuthEventEmitter,
        ...(options.mfa?.enabled ? [MfaService] : []),
        ...(options.apiKeys?.enabled ? [ApiKeysService] : []),
        ...(options.magicLink?.enabled ? [MagicLinkService] : []),
        ...(options.oauth ? [OAuthService] : []),
        TypeOrmModule,
      ],
    };
  }

  static forRootAsync(asyncOptions: {
    imports?: any[];
    inject?: any[];
    useFactory: (...args: any[]) => FortAuthOptions | Promise<FortAuthOptions>;
  }): DynamicModule {
    // In async mode, we register ALL providers and controllers since
    // options are not available at module definition time. Optional
    // features check options at runtime via their guards/services.
    const providers: Provider[] = [
      {
        provide: FORTAUTH_OPTIONS,
        inject: asyncOptions.inject || [],
        useFactory: asyncOptions.useFactory,
      },
      AuthService,
      TokenService,
      PasswordService,
      OtpService,
      JwtStrategy,
      SessionsService,
      BruteForceService,
      BruteForceGuard,
      FortAuthEventEmitter,
      // Optional feature services — always registered in async mode
      MfaService,
      ApiKeysService,
      MagicLinkService,
      OAuthService,
      // Global guards (ApiKeyGuard already checks options.apiKeys?.enabled at runtime)
      { provide: APP_GUARD, useClass: ApiKeyGuard },
      { provide: APP_GUARD, useClass: FortAuthGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
    ];

    const controllers: Type[] = [
      AuthController,
      SessionsController,
      MfaController,
      ApiKeysController,
      MagicLinkController,
      OAuthController,
    ];

    // Load optional OAuth strategies if their deps are installed
    if (GoogleStrategy) providers.push(GoogleStrategy);
    if (GitHubStrategy) providers.push(GitHubStrategy);

    return {
      module: FortAuthCoreModule,
      global: true,
      imports: [
        ...(asyncOptions.imports || []),
        TypeOrmModule.forFeature([...FORT_ENTITIES]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: asyncOptions.imports || [],
          inject: asyncOptions.inject || [],
          useFactory: async (...args: any[]) => {
            const options = await asyncOptions.useFactory(...args);
            return {
              secret: options.jwt.secret,
              signOptions: {
                expiresIn: (options.jwt.accessTokenExpiry || '15m') as any,
              },
            };
          },
        }),
      ],
      controllers,
      providers,
      exports: [
        FORTAUTH_OPTIONS,
        AuthService,
        TokenService,
        PasswordService,
        OtpService,
        SessionsService,
        BruteForceService,
        FortAuthEventEmitter,
        MfaService,
        ApiKeysService,
        MagicLinkService,
        OAuthService,
        TypeOrmModule,
      ],
    };
  }
}
