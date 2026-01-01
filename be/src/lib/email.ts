import { Resend } from 'resend';
import { env } from '@/config/env';

const resend = new Resend(env.RESEND_API_KEY);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: `VIPS <${env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email service error:', error);
    return false;
  }
}

// Brand colors
const colors = {
  bg: '#09090b',
  cardBg: '#18181b',
  cardBorder: '#27272a',
  text: '#a1a1aa',
  textMuted: '#71717a',
  textDark: '#52525b',
  white: '#ffffff',
  brand: '#ec4899',
  brandDark: '#be185d',
  purple: '#8b5cf6',
  green: '#22c55e',
  greenDark: '#16a34a',
  orange: '#f59e0b',
  red: '#ef4444',
  cyan: '#06b6d4',
};

// Base template wrapper - fully responsive and email-safe
function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>VIPS</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    * { box-sizing: border-box; }
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 0 16px !important; }
      .content { padding: 24px 20px !important; }
      .button { padding: 14px 28px !important; }
      .title { font-size: 24px !important; }
      .feature-cell { display: block !important; width: 100% !important; padding-bottom: 12px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${colors.bg};">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <!--[if mso]>
        <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="560">
        <tr>
        <td>
        <![endif]-->
        <table role="presentation" class="container" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size: 36px; font-weight: 900; font-style: italic; letter-spacing: -2px; color: ${colors.brand};">
                    VIPS
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${colors.cardBg}; border: 1px solid ${colors.cardBorder}; border-radius: 16px;">
                ${content}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 20px 0;">
              <p style="margin: 0 0 8px; color: ${colors.textDark}; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} VIPS. Todos os direitos reservados.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5;">
                <a href="${env.FRONTEND_URL}" style="color: ${colors.textMuted}; text-decoration: none;">vips.lat</a>
              </p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Email templates
export function emailVerificationTemplate(name: string, verificationUrl: string): string {
  const content = `
    <tr>
      <td class="content" style="padding: 40px 32px;">
        <!-- Icon -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 64px; height: 64px; background-color: ${colors.brand}; border-radius: 50%; text-align: center; vertical-align: middle;">
                    <span style="font-size: 28px; line-height: 64px;">✉️</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Title -->
        <h1 class="title" style="margin: 0 0 16px; color: ${colors.white}; font-size: 28px; font-weight: 700; text-align: center; line-height: 1.2;">
          Verifique seu email
        </h1>

        <!-- Description -->
        <p style="margin: 0 0 32px; color: ${colors.text}; font-size: 15px; line-height: 1.6; text-align: center;">
          Olá${name ? ` <strong style="color: ${colors.white};">${name}</strong>` : ''}! Estamos felizes em ter você na VIPS. Confirme seu email para começar a explorar conteúdo exclusivo.
        </p>

        <!-- Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <a href="${verificationUrl}" class="button" style="display: inline-block; background-color: ${colors.brand}; color: ${colors.white}; font-size: 15px; font-weight: 600; text-decoration: none; padding: 16px 32px; border-radius: 10px;">
                Verificar meu email
              </a>
            </td>
          </tr>
        </table>

        <!-- Footer Note -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid ${colors.cardBorder};">
          <tr>
            <td style="padding-top: 24px;">
              <p style="margin: 0; color: ${colors.textDark}; font-size: 13px; text-align: center; line-height: 1.5;">
                Este link expira em <strong style="color: ${colors.textMuted};">24 horas</strong>.<br>
                Se você não criou uma conta, ignore este email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return baseTemplate(content);
}

export function passwordResetTemplate(name: string, resetUrl: string): string {
  const content = `
    <tr>
      <td class="content" style="padding: 40px 32px;">
        <!-- Icon -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 64px; height: 64px; background-color: ${colors.orange}; border-radius: 50%; text-align: center; vertical-align: middle;">
                    <span style="font-size: 28px; line-height: 64px;">🔐</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Title -->
        <h1 class="title" style="margin: 0 0 16px; color: ${colors.white}; font-size: 28px; font-weight: 700; text-align: center; line-height: 1.2;">
          Redefinir senha
        </h1>

        <!-- Description -->
        <p style="margin: 0 0 32px; color: ${colors.text}; font-size: 15px; line-height: 1.6; text-align: center;">
          Olá${name ? ` <strong style="color: ${colors.white};">${name}</strong>` : ''}! Recebemos uma solicitação para redefinir sua senha. Clique abaixo para criar uma nova.
        </p>

        <!-- Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <a href="${resetUrl}" class="button" style="display: inline-block; background-color: ${colors.orange}; color: ${colors.white}; font-size: 15px; font-weight: 600; text-decoration: none; padding: 16px 32px; border-radius: 10px;">
                Redefinir minha senha
              </a>
            </td>
          </tr>
        </table>

        <!-- Warning -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="background-color: rgba(239, 68, 68, 0.1); border-radius: 10px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0; color: #fca5a5; font-size: 13px; text-align: center; line-height: 1.5;">
                ⚠️ Se você não solicitou, sua conta pode estar em risco. Altere sua senha imediatamente.
              </p>
            </td>
          </tr>
        </table>

        <!-- Footer Note -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid ${colors.cardBorder};">
          <tr>
            <td style="padding-top: 24px;">
              <p style="margin: 0; color: ${colors.textDark}; font-size: 13px; text-align: center; line-height: 1.5;">
                Este link expira em <strong style="color: ${colors.textMuted};">1 hora</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return baseTemplate(content);
}

export function welcomeCreatorTemplate(name: string): string {
  const content = `
    <!-- Header Banner -->
    <tr>
      <td style="background-color: ${colors.brand}; padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center;">
        <span style="font-size: 48px; display: block; margin-bottom: 16px;">🎉</span>
        <h1 style="margin: 0 0 8px; color: ${colors.white}; font-size: 26px; font-weight: 800; line-height: 1.2;">
          Bem-vindo, ${name}!
        </h1>
        <p style="margin: 0; color: rgba(255,255,255,0.85); font-size: 15px;">
          Sua jornada como criador começa agora
        </p>
      </td>
    </tr>

    <tr>
      <td class="content" style="padding: 32px;">
        <!-- Intro -->
        <p style="margin: 0 0 28px; color: ${colors.text}; font-size: 15px; line-height: 1.6; text-align: center;">
          Seu perfil de criador foi ativado! Você agora faz parte de uma comunidade exclusiva que monetiza conteúdo e constrói relacionamentos únicos com fãs.
        </p>

        <!-- Features -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
          <!-- Feature 1 -->
          <tr>
            <td style="padding: 14px 16px; background-color: rgba(236, 72, 153, 0.1); border-radius: 10px; margin-bottom: 10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="40" valign="top" style="font-size: 22px;">💰</td>
                  <td>
                    <p style="margin: 0 0 2px; color: ${colors.white}; font-size: 14px; font-weight: 600;">Monetização Direta</p>
                    <p style="margin: 0; color: ${colors.textMuted}; font-size: 13px;">Assinaturas, gorjetas e PPV</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <!-- Feature 2 -->
          <tr>
            <td style="padding: 14px 16px; background-color: rgba(139, 92, 246, 0.1); border-radius: 10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="40" valign="top" style="font-size: 22px;">⚡</td>
                  <td>
                    <p style="margin: 0 0 2px; color: ${colors.white}; font-size: 14px; font-weight: 600;">Pagamento Instantâneo</p>
                    <p style="margin: 0; color: ${colors.textMuted}; font-size: 13px;">Receba via PIX em tempo real</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <!-- Feature 3 -->
          <tr>
            <td style="padding: 14px 16px; background-color: rgba(6, 182, 212, 0.1); border-radius: 10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="40" valign="top" style="font-size: 22px;">📊</td>
                  <td>
                    <p style="margin: 0 0 2px; color: ${colors.white}; font-size: 14px; font-weight: 600;">Analytics Completo</p>
                    <p style="margin: 0; color: ${colors.textMuted}; font-size: 13px;">Acompanhe ganhos e engajamento</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Tip -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="background-color: rgba(34, 197, 94, 0.1); border-radius: 10px; padding: 14px 16px; margin-bottom: 28px;">
              <p style="margin: 0; color: #86efac; font-size: 13px; text-align: center; line-height: 1.5;">
                💡 <strong>Dica:</strong> Configure sua chave PIX no Dashboard para receber pagamentos!
              </p>
            </td>
          </tr>
        </table>

        <!-- Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding-top: 20px;">
          <tr>
            <td align="center">
              <a href="${env.FRONTEND_URL}/dashboard" class="button" style="display: inline-block; background-color: ${colors.brand}; color: ${colors.white}; font-size: 15px; font-weight: 600; text-decoration: none; padding: 16px 32px; border-radius: 10px;">
                Acessar meu Dashboard
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return baseTemplate(content);
}

export function paymentConfirmedTemplate(name: string, amount: string, description: string): string {
  const content = `
    <tr>
      <td class="content" style="padding: 40px 32px;">
        <!-- Icon -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 64px; height: 64px; background-color: ${colors.green}; border-radius: 50%; text-align: center; vertical-align: middle;">
                    <span style="font-size: 28px; line-height: 64px;">✅</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Title -->
        <h1 class="title" style="margin: 0 0 16px; color: ${colors.white}; font-size: 28px; font-weight: 700; text-align: center; line-height: 1.2;">
          Pagamento Confirmado!
        </h1>

        <!-- Description -->
        <p style="margin: 0 0 28px; color: ${colors.text}; font-size: 15px; line-height: 1.6; text-align: center;">
          Olá${name ? ` <strong style="color: ${colors.white};">${name}</strong>` : ''}! Seu pagamento foi processado com sucesso.
        </p>

        <!-- Payment Details -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: rgba(34, 197, 94, 0.1); border-radius: 12px; margin-bottom: 28px;">
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding-bottom: 16px; border-bottom: 1px solid rgba(34, 197, 94, 0.2);">
                    <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Valor pago</p>
                    <p style="margin: 0; color: ${colors.green}; font-size: 28px; font-weight: 700;">${amount}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 16px;">
                    <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Descrição</p>
                    <p style="margin: 0; color: ${colors.white}; font-size: 15px; font-weight: 500;">${description}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Info -->
        <p style="margin: 0 0 28px; color: ${colors.textMuted}; font-size: 14px; text-align: center; line-height: 1.5;">
          Você já pode acessar o conteúdo adquirido. Aproveite!
        </p>

        <!-- Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center">
              <a href="${env.FRONTEND_URL}/feed" class="button" style="display: inline-block; background-color: ${colors.green}; color: ${colors.white}; font-size: 15px; font-weight: 600; text-decoration: none; padding: 16px 32px; border-radius: 10px;">
                Ver meu conteúdo
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return baseTemplate(content);
}

// New subscriber notification for creators
export function newSubscriberTemplate(creatorName: string, subscriberName: string, amount: string): string {
  const content = `
    <tr>
      <td class="content" style="padding: 40px 32px;">
        <!-- Icon -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 64px; height: 64px; background-color: ${colors.purple}; border-radius: 50%; text-align: center; vertical-align: middle;">
                    <span style="font-size: 28px; line-height: 64px;">🎊</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Title -->
        <h1 class="title" style="margin: 0 0 16px; color: ${colors.white}; font-size: 28px; font-weight: 700; text-align: center; line-height: 1.2;">
          Novo Assinante!
        </h1>

        <!-- Description -->
        <p style="margin: 0 0 28px; color: ${colors.text}; font-size: 15px; line-height: 1.6; text-align: center;">
          Parabéns, <strong style="color: ${colors.white};">${creatorName}</strong>! Você tem um novo assinante.
        </p>

        <!-- Subscriber Details -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: rgba(139, 92, 246, 0.1); border-radius: 12px; margin-bottom: 28px;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="margin: 0 0 8px; color: ${colors.white}; font-size: 18px; font-weight: 600;">${subscriberName}</p>
              <p style="margin: 0; color: ${colors.green}; font-size: 24px; font-weight: 700;">+${amount}</p>
            </td>
          </tr>
        </table>

        <!-- Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center">
              <a href="${env.FRONTEND_URL}/subscribers" class="button" style="display: inline-block; background-color: ${colors.purple}; color: ${colors.white}; font-size: 15px; font-weight: 600; text-decoration: none; padding: 16px 32px; border-radius: 10px;">
                Ver Assinantes
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return baseTemplate(content);
}

// Tip received notification for creators
export function tipReceivedTemplate(creatorName: string, fromName: string, amount: string, message?: string): string {
  const content = `
    <tr>
      <td class="content" style="padding: 40px 32px;">
        <!-- Icon -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width: 64px; height: 64px; background-color: ${colors.cyan}; border-radius: 50%; text-align: center; vertical-align: middle;">
                    <span style="font-size: 28px; line-height: 64px;">💸</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Title -->
        <h1 class="title" style="margin: 0 0 16px; color: ${colors.white}; font-size: 28px; font-weight: 700; text-align: center; line-height: 1.2;">
          Você recebeu uma gorjeta!
        </h1>

        <!-- Description -->
        <p style="margin: 0 0 28px; color: ${colors.text}; font-size: 15px; line-height: 1.6; text-align: center;">
          <strong style="color: ${colors.white};">${creatorName}</strong>, você recebeu uma gorjeta de <strong style="color: ${colors.white};">${fromName}</strong>.
        </p>

        <!-- Tip Details -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: rgba(6, 182, 212, 0.1); border-radius: 12px; margin-bottom: 28px;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <p style="margin: 0 0 8px; color: ${colors.green}; font-size: 32px; font-weight: 700;">${amount}</p>
              ${message ? `<p style="margin: 12px 0 0; color: ${colors.text}; font-size: 14px; font-style: italic;">"${message}"</p>` : ''}
            </td>
          </tr>
        </table>

        <!-- Button -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td align="center">
              <a href="${env.FRONTEND_URL}/earnings" class="button" style="display: inline-block; background-color: ${colors.cyan}; color: ${colors.white}; font-size: 15px; font-weight: 600; text-decoration: none; padding: 16px 32px; border-radius: 10px;">
                Ver Ganhos
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return baseTemplate(content);
}
