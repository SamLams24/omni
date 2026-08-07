import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException, ErrorCode } from '../../common/errors/error-codes';
import { toBusinessDto } from './business.mapper';
import type { BboxQuery, BusinessDto } from './dto/business.dto';
import type { CreateBusinessDto } from './dto/create-business.dto';
import type { UpdateBusinessDto } from './dto/update-business.dto';

const SUBSCRIPTION_SELECT = {
  tier: true,
  status: true,
  endDate: true,
} as const;

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  async findInBbox(bbox: BboxQuery): Promise<BusinessDto[]> {
    const businesses = await this.prisma.business.findMany({
      where: {
        source: 'OMNI',
        latitude: { gte: bbox.south, lte: bbox.north },
        longitude: { gte: bbox.west, lte: bbox.east },
      },
      include: { subscriptions: { select: SUBSCRIPTION_SELECT } },
    });
    return businesses.map((business) => toBusinessDto(business));
  }

  async findById(id: string): Promise<BusinessDto> {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: { subscriptions: { select: SUBSCRIPTION_SELECT } },
    });
    if (!business) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.BUSINESS_NOT_FOUND,
        "Cette entreprise n'existe pas.",
      );
    }
    return toBusinessDto(business);
  }

  async listOwnedBy(userId: string): Promise<BusinessDto[]> {
    const businesses = await this.prisma.business.findMany({
      where: { owners: { some: { userId } } },
      include: { subscriptions: { select: SUBSCRIPTION_SELECT } },
    });
    return businesses.map((business) => toBusinessDto(business));
  }

  async listAll(): Promise<BusinessDto[]> {
    const businesses = await this.prisma.business.findMany({
      include: { subscriptions: { select: SUBSCRIPTION_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return businesses.map((business) => toBusinessDto(business));
  }

  async create(userId: string, dto: CreateBusinessDto): Promise<BusinessDto> {
    const business = await this.prisma.business.create({
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
        description: dto.description,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        neighborhood: dto.neighborhood,
        latitude: dto.latitude,
        longitude: dto.longitude,
        source: 'OMNI',
        owners: { create: { userId, role: 'owner' } },
      },
      include: { subscriptions: { select: SUBSCRIPTION_SELECT } },
    });
    return toBusinessDto(business);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateBusinessDto,
  ): Promise<BusinessDto> {
    await this.assertOwnership(id, userId);
    const business = await this.prisma.business.update({
      where: { id },
      data: dto,
      include: { subscriptions: { select: SUBSCRIPTION_SELECT } },
    });
    return toBusinessDto(business);
  }

  private async assertOwnership(
    businessId: string,
    userId: string,
  ): Promise<void> {
    const owner = await this.prisma.businessOwner.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });
    if (!owner) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_FORBIDDEN,
        "Vous n'êtes pas propriétaire de cette entreprise.",
      );
    }
  }
}
