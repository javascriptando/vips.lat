# VIPS API - Mapa Completo de Endpoints

**Base URL:** `http://localhost:7777`

---

## Autenticação

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/api/auth/register` | - | Registrar novo usuário |
| POST | `/api/auth/login` | - | Login (retorna cookie de sessão) |
| POST | `/api/auth/logout` | ✓ | Logout |
| GET | `/api/auth/me` | ✓ | Dados do usuário logado |

### Register
```json
POST /api/auth/register
{
  "email": "user@email.com",
  "password": "senha123",
  "name": "Nome Completo",
  "username": "nomedeusuario"
}
```

### Login
```json
POST /api/auth/login
{
  "email": "user@email.com",
  "password": "senha123"
}
// Resposta inclui cookie: vips_session
```

---

## Usuários

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/api/users/me` | ✓ | Perfil do usuário logado |
| PUT | `/api/users/me` | ✓ | Atualizar perfil |
| POST | `/api/users/me/avatar` | ✓ | Upload de avatar (multipart) |

### Atualizar Perfil
```json
PUT /api/users/me
{
  "name": "Novo Nome",
  "username": "novousername",
  "bio": "Minha bio"
}
```

### Upload Avatar
```
POST /api/users/me/avatar
Content-Type: multipart/form-data
file: <arquivo de imagem>
```

---

## Criadores

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/api/creators` | ✓ | Tornar-se criador |
| GET | `/api/creators` | - | Listar/buscar criadores |
| GET | `/api/creators/featured` | - | Criadores em destaque |
| GET | `/api/creators/recent` | - | Criadores recentes |
| GET | `/api/creators/me` | ✓ Creator | Meu perfil de criador |
| PUT | `/api/creators/me` | ✓ Creator | Atualizar perfil de criador |
| POST | `/api/creators/me/cover` | ✓ Creator | Upload de capa (multipart) |
| POST | `/api/creators/me/pix-key` | ✓ Creator | Configurar chave PIX |
| GET | `/api/creators/me/stats` | ✓ Creator | Estatísticas |
| GET | `/api/creators/me/balance` | ✓ Creator | Saldo disponível |
| GET | `/api/creators/:username` | - | Perfil público do criador |

### Tornar-se Criador
```json
POST /api/creators
{
  "displayName": "Nome de Exibição",
  "bio": "Minha bio",
  "subscriptionPrice": 2999,  // R$ 29,99 em centavos
  "cpfCnpj": "12345678901"    // opcional
}
```

### Buscar Criadores
```
GET /api/creators?search=texto&minPrice=1000&maxPrice=5000&verified=true&isPro=true&sortBy=subscriberCount&sortOrder=desc&page=1&pageSize=20
```

---

## Conteúdo

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/api/content` | ✓ Creator | Criar conteúdo (multipart) |
| GET | `/api/content` | ✓ | Feed pessoal (assinaturas) |
| GET | `/api/content/explore` | - | Feed de exploração (público) |
| GET | `/api/content/trending` | - | Conteúdo em alta |
| GET | `/api/content/:id` | - | Ver conteúdo específico |
| PUT | `/api/content/:id` | ✓ Creator | Editar conteúdo |
| DELETE | `/api/content/:id` | ✓ Creator | Deletar conteúdo |
| POST | `/api/content/:id/like` | ✓ | Curtir/descurtir |
| GET | `/api/content/creator/:creatorId` | - | Listar conteúdo de um criador |

### Criar Conteúdo
```
POST /api/content
Content-Type: multipart/form-data

type: "post" | "image" | "video"
visibility: "public" | "subscribers" | "ppv"
text: "Texto do post"
ppvPrice: 999  // só se visibility=ppv, em centavos
file0: <arquivo>
file1: <arquivo>
...
```

### Resposta de Conteúdo
```json
{
  "id": "uuid",
  "visibility": "public|subscribers|ppv",
  "hasAccess": true,      // Pode ver o conteúdo
  "hasPurchased": false,  // Comprou (se PPV)
  "hasLiked": false,      // Curtiu
  "hasBookmarked": true,  // Salvou
  "media": []             // Só aparece se hasAccess=true
}
```

---

## Comentários

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/api/comments/:contentId` | - | Listar comentários |
| POST | `/api/comments/:contentId` | ✓ | Criar comentário |
| PUT | `/api/comments/:id` | ✓ | Editar comentário |
| DELETE | `/api/comments/:id` | ✓ | Deletar comentário |
| POST | `/api/comments/:id/like` | ✓ | Curtir/descurtir comentário |

### Criar Comentário
```json
POST /api/comments/:contentId
{
  "text": "Meu comentário",
  "parentId": "uuid"  // opcional, para resposta
}
```

---

## Favoritos e Bookmarks

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/api/favorites/creators` | ✓ | Listar criadores favoritos |
| POST | `/api/favorites/creators/:creatorId` | ✓ | Toggle favorito |
| GET | `/api/favorites/creators/:creatorId/status` | ✓ | Verificar se é favorito |
| GET | `/api/favorites/bookmarks` | ✓ | Listar conteúdos salvos |
| POST | `/api/favorites/bookmarks/:contentId` | ✓ | Toggle bookmark |
| GET | `/api/favorites/bookmarks/:contentId/status` | ✓ | Verificar se está salvo |

---

## Notificações

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/api/notifications` | ✓ | Listar notificações |
| GET | `/api/notifications/unread-count` | ✓ | Contar não lidas |
| POST | `/api/notifications/:id/read` | ✓ | Marcar como lida |
| POST | `/api/notifications/read-all` | ✓ | Marcar todas como lidas |
| DELETE | `/api/notifications/:id` | ✓ | Deletar notificação |

---

## Assinaturas

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/api/subscriptions` | ✓ | Minhas assinaturas |
| GET | `/api/subscriptions/:id` | ✓ | Detalhes de uma assinatura |
| POST | `/api/subscriptions/:id/cancel` | ✓ | Cancelar assinatura |

---

## Pagamentos

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/api/payments/subscription` | ✓ | Pagar assinatura (gera QR PIX) |
| POST | `/api/payments/ppv` | ✓ | Comprar conteúdo PPV |
| POST | `/api/payments/tip` | ✓ | Enviar gorjeta |
| POST | `/api/payments/pro-plan` | ✓ Creator | Assinar plano PRO |
| GET | `/api/payments` | ✓ | Histórico de pagamentos |
| GET | `/api/payments/:id` | ✓ | Detalhes de pagamento |

### Pagar Assinatura
```json
POST /api/payments/subscription
{
  "creatorId": "uuid",
  "cpfCnpj": "12345678901"  // obrigatório na primeira vez
}
// Resposta: QR Code PIX
```

### Comprar PPV
```json
POST /api/payments/ppv
{
  "contentId": "uuid",
  "cpfCnpj": "12345678901"
}
```

### Enviar Gorjeta
```json
POST /api/payments/tip
{
  "creatorId": "uuid",
  "amount": 1000,  // R$ 10,00 em centavos
  "message": "Mensagem opcional",
  "cpfCnpj": "12345678901"
}
```

---

## Saques (Payouts)

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/api/payouts/request` | ✓ Creator | Solicitar saque |
| GET | `/api/payouts` | ✓ Creator | Histórico de saques |

### Solicitar Saque
```json
POST /api/payouts/request
{
  "amount": 10000  // R$ 100,00 em centavos (mínimo R$ 20,00)
}
```

---

## Mídia (Uploads)

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/uploads/*` | - | Acessar arquivos de mídia |

### Tipos Permitidos
| Tipo | Formatos | Tamanho Máximo |
|------|----------|----------------|
| Imagem | JPEG, PNG, WebP, GIF | 10MB |
| Vídeo | MP4, WebM, QuickTime | 500MB |
| Avatar | JPEG, PNG, WebP | 5MB |

---

## Webhooks (Asaas)

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/webhooks/asaas` | - | Webhook de pagamentos |

---

## Health Check

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/health` | - | Status do servidor |

---

## Códigos de Resposta

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Acesso negado |
| 404 | Não encontrado |
| 429 | Rate limit excedido |
| 500 | Erro interno |

---

## Taxas e Limites

### Taxas
| Tipo | Taxa Plataforma | Criador Recebe |
|------|-----------------|----------------|
| Assinatura | 10% | 90% |
| PPV | 10% | 90% |
| Gorjeta | 5% | 95% |
| Taxa PIX | R$ 1,99 | (pago pelo cliente) |

### Limites de Preço (em centavos)
| Limite | Valor |
|--------|-------|
| Assinatura mínima | R$ 9,99 (999) |
| Assinatura máxima | R$ 999,99 (99999) |
| PPV mínimo | R$ 9,99 (999) |
| PPV máximo | R$ 999,99 (99999) |
| Gorjeta mínima | R$ 5,00 (500) |
| Saque mínimo | R$ 20,00 (2000) |
| Plano PRO | R$ 49,90 (4990) |

---

## Autenticação

Todas as rotas marcadas com ✓ requerem o cookie `vips_session` que é retornado após login.

```javascript
// Exemplo com fetch
fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',  // IMPORTANTE!
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// Todas as outras requisições
fetch('/api/content', {
  credentials: 'include'  // Envia o cookie automaticamente
});
```

---

## Paginação

Todas as rotas de listagem suportam:
```
?page=1&pageSize=20
```

Resposta padrão:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```
