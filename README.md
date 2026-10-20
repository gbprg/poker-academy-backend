# Poker Academy Backend

API privada da Poker Academy em NestJS, TypeScript, Prisma e PostgreSQL.

## Requisitos

- Node.js 22.23.1
- npm 12.2.0
- Docker com Compose

## Ambiente local

Copie `.env.example` para `.env`. As credenciais do exemplo servem somente para o PostgreSQL local do Compose e nunca devem ser reutilizadas remotamente.

```bash
npx --yes npm@12.2.0 ci
docker compose up -d postgres
npx --yes npm@12.2.0 run db:deploy
npx --yes npm@12.2.0 run start:dev
```

A API usa o prefixo `/api`:

- Health: `GET http://localhost:3000/api/health`
- OpenAPI JSON: `GET http://localhost:3000/api/docs-json`
- Swagger UI: `GET http://localhost:3000/api/docs`

O health check consulta o PostgreSQL e devolve erro sanitizado quando o banco esta indisponivel.

As tabelas de identidade usam `citext` no PostgreSQL para garantir unicidade de
e-mail sem diferenciar maiusculas de minusculas. Segredos de ativacao sao
persistidos somente como hashes SHA-256 de consulta. As FKs de ativacoes e
sessoes usam `RESTRICT` para impedir a remocao acidental do historico. Senhas de
ADMIN usam Argon2id; login e ativacao entram na task P02-T03.

## Primeiro administrador

O bootstrap nao possui endpoint HTTP e nao usa credenciais padrao:

```bash
BOOTSTRAP_ADMIN_NAME='Nome' \
BOOTSTRAP_ADMIN_EMAIL='admin@example.com' \
BOOTSTRAP_ADMIN_PASSWORD='senha privada longa' \
npm run bootstrap:admin
```

O comando e idempotente para um ADMIN ja ativo e nunca imprime a senha ou o
hash. Depois do bootstrap, `POST /api/admin/users` exige uma sessao ADMIN valida
e devolve o link privado de ativacao somente na resposta de criacao. Nao existe
rota publica de cadastro.

## Verificacao

```bash
npx --yes npm@12.2.0 test
npx --yes npm@12.2.0 run test:e2e
npx --yes npm@12.2.0 run lint
npx --yes npm@12.2.0 run build
npx --yes npm@12.2.0 audit --audit-level=high
```

## Deploy

O destino aprovado e um unico Web Service no Render conectado a PostgreSQL persistente. O servico deve receber `DATABASE_URL`, `PORT` e demais secrets pelo ambiente do provedor. Nunca use o volume local do Compose ou o filesystem efemero do Render como persistencia de producao.
