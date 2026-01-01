// Taxas e fees
export const FEES = {
  // Taxa PIX Asaas (paga pelo cliente)
  PIX_FEE: 199, // R$ 1,99 em centavos

  // Split da plataforma
  PLATFORM_FEE_SUBSCRIPTION: 0.10, // 10%
  PLATFORM_FEE_PPV: 0.10,          // 10%
  PLATFORM_FEE_TIP: 0.05,          // 5%

  // Creator share
  CREATOR_SHARE_SUBSCRIPTION: 0.90, // 90%
  CREATOR_SHARE_PPV: 0.90,          // 90%
  CREATOR_SHARE_TIP: 0.95,          // 95%
} as const;

// Limites
export const LIMITS = {
  MIN_SUBSCRIPTION_PRICE: 999,  // R$ 9,99
  MAX_SUBSCRIPTION_PRICE: 99999, // R$ 999,99
  MIN_TIP_AMOUNT: 990,          // R$ 9,90
  MIN_PPV_PRICE: 999,           // R$ 9,99
  MAX_PPV_PRICE: 99999,         // R$ 999,99
  MIN_PAYOUT_AMOUNT: 2000,      // R$ 20,00

  PRO_PLAN_PRICE: 4990,         // R$ 49,90

  // Upload
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,   // 10MB
  MAX_VIDEO_SIZE: 500 * 1024 * 1024,  // 500MB
  MAX_AVATAR_SIZE: 5 * 1024 * 1024,   // 5MB

  // Content
  MAX_POST_LENGTH: 5000,
  MAX_BIO_LENGTH: 500,
  MAX_DISPLAY_NAME_LENGTH: 100,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Tipos de mídia permitidos
export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

// Duração de sessão
export const SESSION_DURATION = {
  DEFAULT: 30 * 24 * 60 * 60 * 1000, // 30 dias
  REMEMBER_ME: 90 * 24 * 60 * 60 * 1000, // 90 dias
} as const;

// Status de pagamento Asaas
export const ASAAS_PAYMENT_STATUS = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
  CONFIRMED: 'CONFIRMED',
  OVERDUE: 'OVERDUE',
  REFUNDED: 'REFUNDED',
  RECEIVED_IN_CASH: 'RECEIVED_IN_CASH',
  REFUND_REQUESTED: 'REFUND_REQUESTED',
  CHARGEBACK_REQUESTED: 'CHARGEBACK_REQUESTED',
  CHARGEBACK_DISPUTE: 'CHARGEBACK_DISPUTE',
  AWAITING_CHARGEBACK_REVERSAL: 'AWAITING_CHARGEBACK_REVERSAL',
  DUNNING_REQUESTED: 'DUNNING_REQUESTED',
  DUNNING_RECEIVED: 'DUNNING_RECEIVED',
  AWAITING_RISK_ANALYSIS: 'AWAITING_RISK_ANALYSIS',
} as const;
