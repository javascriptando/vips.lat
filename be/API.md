# VIPS API Documentation

**Base URL:** `http://localhost:7777/api`

---

## Authentication

All authenticated endpoints require a session cookie (`vips_session`).

---

## Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Criar conta |
| POST | `/auth/login` | No | Fazer login |
| POST | `/auth/logout` | Yes | Fazer logout |
| GET | `/auth/me` | No | Usuário atual |
| POST | `/auth/verify-email` | No | Verificar email |
| POST | `/auth/resend-verification` | Yes | Reenviar verificação |
| POST | `/auth/forgot-password` | No | Solicitar reset de senha |
| POST | `/auth/reset-password` | No | Redefinir senha |
| POST | `/auth/change-password` | Yes | Alterar senha |

#### POST /auth/register
```json
{
  "email": "user@example.com",
  "password": "minimo8chars",
  "name": "Nome Opcional"
}
```

#### POST /auth/login
```json
{
  "email": "user@example.com",
  "password": "senha123"
}
```

---

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | Yes | Meu perfil |
| PUT | `/users/me` | Yes | Atualizar perfil |
| POST | `/users/me/avatar` | Yes | Upload avatar (multipart) |
| DELETE | `/users/me/avatar` | Yes | Remover avatar |
| GET | `/users/check-username/:username` | No | Verificar disponibilidade |
| GET | `/users/:username` | No | Perfil público |

#### PUT /users/me
```json
{
  "name": "Novo Nome",
  "username": "meu_username"
}
```

---

### Creators

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/creators` | Yes | Tornar-se criador |
| GET | `/creators` | No | Listar criadores |
| GET | `/creators/me` | Creator | Meu perfil de criador |
| PUT | `/creators/me` | Creator | Atualizar perfil |
| POST | `/creators/me/cover` | Creator | Upload cover (multipart) |
| POST | `/creators/me/pix-key` | Creator | Configurar chave PIX |
| GET | `/creators/me/stats` | Creator | Estatísticas |
| GET | `/creators/me/balance` | Creator | Saldo disponível |
| GET | `/creators/:username` | No | Perfil público do criador |

#### POST /creators
```json
{
  "displayName": "Meu Nome Artístico",
  "bio": "Descrição opcional",
  "subscriptionPrice": 2999,
  "cpfCnpj": "123.456.789-00"
}
```
> `subscriptionPrice` em centavos (2999 = R$ 29,99)

#### GET /creators?page=1&pageSize=20&search=&sortBy=subscriberCount&sortOrder=desc

#### POST /creators/me/pix-key
```json
{
  "pixKey": "email@example.com"
}
```

---

### Content

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/content` | Creator | Criar conteúdo (multipart) |
| GET | `/content` | Yes | Feed personalizado |
| GET | `/content/:id` | No | Ver conteúdo |
| PUT | `/content/:id` | Creator | Editar conteúdo |
| DELETE | `/content/:id` | Creator | Remover conteúdo |
| POST | `/content/:id/like` | Yes | Curtir/descurtir |
| GET | `/content/creator/:creatorId` | No | Conteúdo de um criador |

#### POST /content (multipart/form-data)
```
type: "post" | "image" | "video"
visibility: "public" | "subscribers" | "ppv"
text: "Texto do post"
ppvPrice: 999 (se visibility = ppv)
file: [arquivos de mídia]
```

---

### Subscriptions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/subscriptions` | Yes | Iniciar assinatura |
| GET | `/subscriptions` | Yes | Minhas assinaturas |
| GET | `/subscriptions/check/:creatorId` | Yes | Verificar se assina |
| GET | `/subscriptions/:id` | Yes | Detalhes da assinatura |
| DELETE | `/subscriptions/:id` | Yes | Cancelar assinatura |
| GET | `/subscriptions/me/subscribers` | Creator | Meus assinantes |

#### POST /subscriptions
```json
{
  "creatorId": "uuid-do-criador"
}
```

---

### Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/payments/subscription` | Yes | Pagar assinatura (PIX) |
| POST | `/payments/ppv` | Yes | Comprar conteúdo PPV |
| POST | `/payments/tip` | Yes | Enviar gorjeta |
| POST | `/payments/pro` | Creator | Assinar plano PRO |
| GET | `/payments` | Yes | Histórico de pagamentos |
| GET | `/payments/:id` | Yes | Detalhes do pagamento |
| GET | `/payments/:id/status` | Yes | Status do pagamento |
| GET | `/payments/me/earnings` | Creator | Meus ganhos |

#### POST /payments/subscription
```json
{
  "creatorId": "uuid-do-criador"
}
```
**Response:**
```json
{
  "message": "Pagamento criado! Escaneie o QR Code.",
  "payment": { ... },
  "qrCode": {
    "payload": "00020126...",
    "image": "base64...",
    "expiresAt": "2024-01-01T00:00:00Z"
  },
  "amount": 2999,
  "pixFee": 199,
  "total": 3198
}
```

#### POST /payments/tip
```json
{
  "creatorId": "uuid-do-criador",
  "amount": 1000,
  "message": "Ótimo conteúdo!"
}
```
> `amount` em centavos (mínimo 500 = R$ 5,00)

---

### Payouts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/payouts` | Creator | Solicitar saque |
| GET | `/payouts` | Creator | Histórico de saques |
| GET | `/payouts/balance` | Creator | Saldo disponível |
| GET | `/payouts/:id` | Creator | Detalhes do saque |

#### POST /payouts
```json
{
  "amount": 5000
}
```
> Se `amount` não informado, saca todo o saldo disponível.
> Mínimo: R$ 20,00 (2000 centavos)

---

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/asaas` | Webhook do Asaas |

---

## Response Formats

### Success
```json
{
  "message": "Operação realizada com sucesso",
  "data": { ... }
}
```

### Error
```json
{
  "error": "Mensagem de erro"
}
```

### Paginated
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## Rate Limits

| Endpoint | Limite |
|----------|--------|
| `/api/*` | 100 req/min |
| `/auth/*` | 5 req/15min |
| Upload | 10 req/min |
| Payments | 10 req/min |

Headers de resposta:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Valores em Centavos

Todos os valores monetários são em **centavos**:
- R$ 29,99 = `2999`
- R$ 9,99 = `999`
- R$ 1,99 = `199`

---

## Status de Pagamento

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando pagamento |
| `confirmed` | Pagamento confirmado |
| `failed` | Pagamento falhou |
| `refunded` | Reembolsado |
| `expired` | Expirado |

---

## Status de Assinatura

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando primeiro pagamento |
| `active` | Ativa |
| `cancelled` | Cancelada pelo usuário |
| `expired` | Expirada |

---

## Fees (Taxas)

| Tipo | Criador | Plataforma |
|------|---------|------------|
| Assinatura | 90% | 10% |
| PPV | 90% | 10% |
| Gorjeta | 95% | 5% |
| Taxa PIX | - | Paga pelo cliente (R$ 1,99) |

---

## Exemplo de Fluxo de Assinatura

1. **Cliente** chama `POST /payments/subscription`
2. **API** retorna QR Code PIX
3. **Cliente** paga via app do banco
4. **Asaas** envia webhook para `/webhooks/asaas`
5. **API** confirma pagamento e ativa assinatura
6. **Cliente** pode ver conteúdo do criador

---

## Health Check

```
GET /health
```
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```
