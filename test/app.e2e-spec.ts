import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApplication } from './../src/common/configure-application.js';

process.env.DATABASE_URL ??=
  'postgresql://poker_academy:poker_academy_local@localhost:55432/poker_academy?schema=public';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  it('GET /api/health reports application and database readiness', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });

  it('publishes an OpenAPI document under the API prefix', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(response.body.info).toMatchObject({
      title: 'Poker Academy API',
      version: '0.1.0',
    });
    expect(response.body.paths).toHaveProperty('/api/health');
  });

  it('adds defensive content type headers to API responses', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect('x-content-type-options', 'nosniff');
  });

  afterEach(async () => {
    await app.close();
  });
});
