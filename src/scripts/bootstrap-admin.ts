import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { BootstrapAdminService } from '../modules/identity/bootstrap-admin.service.js';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be provided`);
  return value;
}

const application = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});

try {
  const admin = await application.get(BootstrapAdminService).run({
    name: requiredEnvironment('BOOTSTRAP_ADMIN_NAME'),
    email: requiredEnvironment('BOOTSTRAP_ADMIN_EMAIL'),
    password: requiredEnvironment('BOOTSTRAP_ADMIN_PASSWORD'),
  });
  process.stdout.write(`Administrator ready: ${admin.id}\n`);
} finally {
  await application.close();
}
