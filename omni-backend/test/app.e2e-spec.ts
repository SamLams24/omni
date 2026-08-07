import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import type { Env } from './../src/config/env.validation';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors the global prefix main.ts applies at real bootstrap --
    // without it, every route in this test would 404, since AppModule
    // alone (no main.ts) doesn't know about api/v1.
    const config = app.get(ConfigService<Env, true>);
    app.setGlobalPrefix(
      `${config.get('API_PREFIX', { infer: true })}/${config.get('API_VERSION', { infer: true })}`,
    );
    await app.init();
  });

  it('/api/v1/health (GET) is public and reports database connectivity', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'ok' && res.body.status !== 'degraded') {
          throw new Error(`Unexpected health status: ${res.body.status}`);
        }
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
