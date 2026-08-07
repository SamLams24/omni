import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException, ErrorCode } from '../../common/errors/error-codes';

function toUserSummary(user: {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  roles: { role: { name: string } }[];
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    roles: user.roles.map((userRole) => userRole.role.name),
  };
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    const users = await this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(toUserSummary);
  }

  async setActive(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
        "Cet utilisateur n'existe pas.",
      );
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      include: { roles: { include: { role: true } } },
    });
    return toUserSummary(updated);
  }
}
