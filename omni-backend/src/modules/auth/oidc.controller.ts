import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import type { Env } from '../../config/env.validation';

/**
 * SCAFFOLDED, NOT FUNCTIONAL: this controller exists so the intended
 * Auth0/OIDC route shape is in place, but the actual authorization-code
 * exchange with Auth0 (redirect to /authorize, verify the returned ID
 * token against Auth0's JWKS, then call IdentityService) is NOT
 * implemented -- there are no Auth0 tenant credentials available in this
 * environment to build this against and verify end-to-end (see AUTH0_* in
 * .env.example). Wiring a real OIDC client without ever exercising it
 * against a real tenant risks landing unverifiable, possibly-broken code.
 *
 * What IS real and unit-tested: IdentityService.linkOrCreateFromOidc(profile)
 * in ./identity.service.ts -- once a verified OidcProfile is available
 * from wherever the token exchange ends up living, this is the function
 * that safely creates/links the OMNI user, with account-linking rules
 * already enforced (docs/api/account-linking.md).
 *
 * See docs/api/authentication.md and docs/architecture/migration-plan.md.
 */
@ApiTags('auth')
@Controller('auth/oidc')
export class OidcController {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  @Public()
  @Get('start')
  @ApiOperation({
    summary:
      '[Not functional without real Auth0 credentials] Start the Auth0 authorization-code flow',
  })
  start(): never {
    const domain = this.configService.get('AUTH0_DOMAIN', { infer: true });
    throw new ServiceUnavailableException({
      code: domain ? 'AUTH0_NOT_IMPLEMENTED' : 'AUTH0_NOT_CONFIGURED',
      message: domain
        ? "Le flux Auth0/OIDC n'est pas encore implémenté."
        : "La connexion sociale n'est pas configurée sur cet environnement.",
    });
  }

  @Public()
  @Get('callback')
  @ApiOperation({
    summary: '[Not functional without real Auth0 credentials] Auth0 callback',
  })
  callback(): never {
    throw new ServiceUnavailableException({
      code: 'AUTH0_NOT_IMPLEMENTED',
      message: "Le flux Auth0/OIDC n'est pas encore implémenté.",
    });
  }
}
