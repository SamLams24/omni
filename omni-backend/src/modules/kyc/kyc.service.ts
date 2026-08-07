import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException, ErrorCode } from '../../common/errors/error-codes';
import type { CreateKycRequestDto } from './dto/create-kyc-request.dto';

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(userId: string, dto: CreateKycRequestDto) {
    const owner = await this.prisma.businessOwner.findUnique({
      where: { businessId_userId: { businessId: dto.businessId, userId } },
    });
    if (!owner) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_FORBIDDEN,
        "Vous n'êtes pas propriétaire de cette entreprise.",
      );
    }

    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: dto.businessId },
    });
    if (business.kycStatus === 'APPROVED') {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.KYC_ALREADY_APPROVED,
        'Cette entreprise est déjà vérifiée.',
      );
    }

    // Resubmitting while a request is already pending updates that same
    // request (new documents) instead of creating a duplicate -- the
    // business should only ever have one open KYC review at a time.
    const existingPending = await this.prisma.kycRequest.findFirst({
      where: { businessId: dto.businessId, status: 'PENDING' },
    });
    if (existingPending) {
      return this.prisma.kycRequest.update({
        where: { id: existingPending.id },
        data: { documents: dto.documents },
      });
    }

    const request = await this.prisma.kycRequest.create({
      data: {
        businessId: dto.businessId,
        userId,
        documents: dto.documents,
        status: 'PENDING',
      },
    });
    await this.prisma.business.update({
      where: { id: dto.businessId },
      data: { kycStatus: 'PENDING' },
    });
    return request;
  }

  listOwnedBy(userId: string) {
    return this.prisma.kycRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listAll() {
    return this.prisma.kycRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { business: { select: { id: true, name: true } } },
    });
  }

  async approve(id: string, reviewerId: string) {
    const request = await this.findOrThrow(id);
    const [updated] = await this.prisma.$transaction([
      this.prisma.kycRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      }),
      this.prisma.business.update({
        where: { id: request.businessId },
        data: { kycStatus: 'APPROVED', kycReviewedAt: new Date() },
      }),
    ]);
    return updated;
  }

  async reject(id: string, reviewerId: string, reason: string) {
    const request = await this.findOrThrow(id);
    const [updated] = await this.prisma.$transaction([
      this.prisma.kycRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          rejectReason: reason,
        },
      }),
      this.prisma.business.update({
        where: { id: request.businessId },
        data: { kycStatus: 'REJECTED', kycReviewedAt: new Date() },
      }),
    ]);
    return updated;
  }

  private async findOrThrow(id: string) {
    const request = await this.prisma.kycRequest.findUnique({ where: { id } });
    if (!request) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.KYC_REQUEST_NOT_FOUND,
        "Cette demande de vérification n'existe pas.",
      );
    }
    return request;
  }
}
