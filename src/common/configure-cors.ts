import type { INestApplication } from '@nestjs/common'

const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:5173'

export function configureCors(app: INestApplication): void {
  const configured = (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const origins = configured.length > 0 ? configured : [DEFAULT_FRONTEND_ORIGIN]

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    credentials: false,
    maxAge: 600,
  })
}
