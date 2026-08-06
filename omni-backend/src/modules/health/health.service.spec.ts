import { Test } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('HealthService', () => {
  it('reports ok when the database responds', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    const service = moduleRef.get(HealthService);
    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
  });

  it('reports degraded when the database query throws', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    const service = moduleRef.get(HealthService);
    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.database).toBe('down');
  });
});
