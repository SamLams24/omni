import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AppException, ErrorCode } from '../../common/errors/error-codes';
import { AuthService } from './auth.service';
import { CookieService } from './cookie.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { AccessTokenPayload } from './token.service';

function sessionMeta(req: Request) {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) {}

  @Public()
  @SkipCsrf() // no session cookie exists yet -- nothing to forge against
  @Post('register')
  @ApiOperation({ summary: 'Create a local account and start a session' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, sessionMeta(req));
    this.cookieService.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
    );
    return { user: result.user };
  }

  @Public()
  @SkipCsrf() // no session cookie exists yet -- nothing to forge against
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email + password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, sessionMeta(req));
    this.cookieService.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
    );
    return { user: result.user };
  }

  @Public()
  @SkipCsrf() // protected by refresh-token rotation + reuse detection instead
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token and issue a new access token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = this.cookieService.readRefreshToken(req);
    if (!presented) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_REFRESH_TOKEN_INVALID,
        'Aucune session à rafraîchir.',
      );
    }
    const result = await this.authService.refresh(presented, sessionMeta(req));
    this.cookieService.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
    );
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const presented = this.cookieService.readRefreshToken(req);
    if (presented) {
      await this.authService.logout(presented);
    }
    this.cookieService.clearAuthCookies(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  async logoutAll(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.sub);
    this.cookieService.clearAuthCookies(res);
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  async me(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.me(user.sub);
  }
}
