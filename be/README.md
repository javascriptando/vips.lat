# VIPS Backend

API backend para a plataforma VIPS.lat.

## Stack

- **Runtime:** Bun
- **Framework:** Hono
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Lucia Auth
- **Payments:** Asaas (PIX)
- **Email:** Resend
- **Cache:** Redis

## Requisitos

- Bun 1.x
- PostgreSQL 16
- Redis 7

## Setup

```bash
# Instalar dependências
bun install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Criar banco de dados
createdb vips

# Rodar migrations
bun run db:push

# Seed (opcional)
bun run db:seed
```

## Desenvolvimento

```bash
# Rodar em modo desenvolvimento (hot reload)
bun run dev

# Typecheck
bun run typecheck

# Visualizar banco
bun run db:studio
```

## Produção

```bash
# Build
bun run build

# Rodar
bun run start
```

## Estrutura

```
src/
├── config/          # Configurações (env, constants)
├── db/
│   ├── schema/      # Schemas Drizzle
│   └── migrations/  # Migrations SQL
├── lib/             # Utilitários (auth, email, asaas, storage)
├── middlewares/     # Middlewares Hono
├── modules/
│   ├── auth/        # Autenticação
│   ├── users/       # Usuários
│   ├── creators/    # Criadores
│   ├── content/     # Conteúdo
│   ├── subscriptions/
│   ├── payments/    # Pagamentos + Webhooks
│   ├── payouts/     # Saques
│   └── media/       # Upload de arquivos
└── types/           # TypeScript types
```

## Endpoints

Ver [API.md](./API.md) para documentação completa.

## Usuários de Teste (após seed)

| Email | Senha | Role |
|-------|-------|------|
| admin@vips.lat | admin123456 | admin |
| creator@vips.lat | creator123456 | creator |
| subscriber@vips.lat | subscriber123456 | subscriber |
