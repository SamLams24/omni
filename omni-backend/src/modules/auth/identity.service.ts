import { HttpStatus, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException, ErrorCode } from '../../common/errors/error-codes';

export type OidcProfile = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  /** e.g. "google-oauth2", "facebook" -- see docs/architecture/ADR-003-identity-provider-model.md */
  connection: string;
};

/**
 * Implements the account-linking rules in docs/api/account-linking.md.
 * Never merges an AUTH0 identity into an existing LOCAL user by email
 * match alone unless the external provider has itself verified that
 * email.
 */
@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async linkOrCreateFromOidc(profile: OidcProfile): Promise<User> {
    const existingIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerUserId: {
          provider: 'AUTH0',
          providerUserId: profile.sub,
        },
      },
      include: { user: true },
    });
    if (existingIdentity) {
      return existingIdentity.user;
    }

    if (!profile.email) {
      // users.email is NOT NULL -- Auth0/social login without an email
      // scope grant cannot create an OMNI account. This is a real,
      // user-facing hard stop, not an internal error.
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.VALIDATION_ERROR,
        'Une adresse e-mail est requise pour créer un compte OMNI.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (!existingUser) {
      return this.prisma.user.create({
        data: {
          name: profile.name ?? profile.email,
          email: profile.email,
          identities: {
            create: {
              provider: 'AUTH0',
              providerUserId: profile.sub,
              email: profile.email,
              emailVerified: profile.emailVerified,
              providerMetadata: { connection: profile.connection },
            },
          },
        },
      });
    }

    if (!profile.emailVerified) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AUTH_LINK_VERIFICATION_REQUIRED,
        'Un compte existe déjà avec cette adresse e-mail. Connectez-vous avec votre mot de passe puis liez ce compte social depuis vos paramètres.',
      );
    }

    await this.prisma.identity.create({
      data: {
        userId: existingUser.id,
        provider: 'AUTH0',
        providerUserId: profile.sub,
        email: profile.email,
        emailVerified: profile.emailVerified,
        providerMetadata: { connection: profile.connection },
      },
    });

    return existingUser;
  }
}
