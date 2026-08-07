import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { OidcController } from './oidc.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { IdentityService } from './identity.service';
import { CookieService } from './cookie.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, OidcController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionService,
    IdentityService,
    CookieService,
    JwtAuthGuard,
  ],
  exports: [AuthService, IdentityService, TokenService],
})
export class AuthModule {}
