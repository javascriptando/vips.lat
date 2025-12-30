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

// Base template wrapper
function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VIPS</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); -webkit-background-clip: text; background-clip: text;">
                    <h1 style="margin: 0; font-size: 42px; font-weight: 900; font-style: italic; letter-spacing: -2px; color: #ec4899;">VIPS</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background: linear-gradient(180deg, #18181b 0%, #1f1f23 100%); border-radius: 24px; border: 1px solid #27272a; overflow: hidden;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 30px 20px;">
              <p style="margin: 0 0 10px; color: #52525b; font-size: 13px;">
                © ${new Date().getFullYear()} VIPS. Todos os direitos reservados.
              </p>
              <p style="margin: 0; color: #3f3f46; font-size: 12px;">
                <a href="${env.FRONTEND_URL}/terms" style="color: #71717a; text-decoration: none;">Termos de Uso</a>
                &nbsp;•&nbsp;
                <a href="${env.FRONTEND_URL}/privacy" style="color: #71717a; text-decoration: none;">Privacidade</a>
                &nbsp;•&nbsp;
                <a href="${env.FRONTEND_URL}" style="color: #71717a; text-decoration: none;">vips.lat</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Email templates
export function emailVerificationTemplate(name: string, verificationUrl: string): string {
  const content = `
    <!-- Icon -->
    <td align="center" style="padding: 40px 40px 20px;">
      <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px;">✉️</span>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 40px 40px;">
      <h2 style="margin: 0 0 15px; color: #ffffff; font-size: 28px; font-weight: 700; text-align: center;">
        Verifique seu email
      </h2>
      <p style="margin: 0 0 25px; color: #a1a1aa; font-size: 16px; line-height: 1.7; text-align: center;">
        Olá${name ? ` <strong style="color: #ffffff;">${name}</strong>` : ''}! Estamos muito felizes em ter você na VIPS.
        Para começar a explorar conteúdo exclusivo dos melhores criadores, confirme seu email.
      </p>

      <!-- Button -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding: 10px 0 30px;">
            <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.4);">
              Verificar meu email
            </a>
          </td>
        </tr>
      </table>

      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, #27272a, transparent); margin: 10px 0 25px;"></div>

      <p style="margin: 0; color: #52525b; font-size: 13px; text-align: center; line-height: 1.6;">
        Este link expira em <strong style="color: #71717a;">24 horas</strong>. Se você não criou uma conta na VIPS, pode ignorar este email com segurança.
      </p>
    </td>
  `;
  return baseTemplate(content);
}

export function passwordResetTemplate(name: string, resetUrl: string): string {
  const content = `
    <!-- Icon -->
    <td align="center" style="padding: 40px 40px 20px;">
      <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px;">🔐</span>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 40px 40px;">
      <h2 style="margin: 0 0 15px; color: #ffffff; font-size: 28px; font-weight: 700; text-align: center;">
        Redefinir sua senha
      </h2>
      <p style="margin: 0 0 25px; color: #a1a1aa; font-size: 16px; line-height: 1.7; text-align: center;">
        Olá${name ? ` <strong style="color: #ffffff;">${name}</strong>` : ''}! Recebemos uma solicitação para redefinir a senha da sua conta VIPS.
        Clique no botão abaixo para criar uma nova senha segura.
      </p>

      <!-- Button -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding: 10px 0 30px;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">
              Redefinir minha senha
            </a>
          </td>
        </tr>
      </table>

      <!-- Security Notice -->
      <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 25px;">
        <p style="margin: 0; color: #fca5a5; font-size: 14px; text-align: center;">
          ⚠️ Se você não solicitou esta redefinição, sua conta pode estar em risco.
          Recomendamos alterar sua senha imediatamente.
        </p>
      </div>

      <p style="margin: 0; color: #52525b; font-size: 13px; text-align: center; line-height: 1.6;">
        Este link expira em <strong style="color: #71717a;">1 hora</strong> por motivos de segurança.
      </p>
    </td>
  `;
  return baseTemplate(content);
}

export function welcomeCreatorTemplate(name: string): string {
  const content = `
    <!-- Gradient Banner -->
    <td style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 50%, #06b6d4 100%); padding: 40px; text-align: center;">
      <span style="font-size: 60px;">🎉</span>
      <h2 style="margin: 20px 0 10px; color: #ffffff; font-size: 32px; font-weight: 800;">
        Bem-vindo à VIPS, ${name}!
      </h2>
      <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 18px;">
        Sua jornada como criador começa agora
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding: 40px;">
      <p style="margin: 0 0 30px; color: #a1a1aa; font-size: 16px; line-height: 1.7; text-align: center;">
        Parabéns! Seu perfil de criador foi ativado com sucesso. Você agora faz parte de uma comunidade exclusiva de criadores que monetizam seu conteúdo e constroem relacionamentos únicos com seus fãs.
      </p>

      <!-- Features Grid -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 30px;">
        <tr>
          <td style="padding: 15px; background: rgba(236, 72, 153, 0.1); border-radius: 16px; border: 1px solid rgba(236, 72, 153, 0.2);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td width="50" valign="top">
                  <span style="font-size: 28px;">💰</span>
                </td>
                <td>
                  <h3 style="margin: 0 0 5px; color: #ffffff; font-size: 16px; font-weight: 600;">Monetização Direta</h3>
                  <p style="margin: 0; color: #71717a; font-size: 14px;">Assinaturas, gorjetas e conteúdo PPV</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height: 12px;"></td></tr>
        <tr>
          <td style="padding: 15px; background: rgba(139, 92, 246, 0.1); border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.2);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td width="50" valign="top">
                  <span style="font-size: 28px;">⚡</span>
                </td>
                <td>
                  <h3 style="margin: 0 0 5px; color: #ffffff; font-size: 16px; font-weight: 600;">Pagamento Instantâneo</h3>
                  <p style="margin: 0; color: #71717a; font-size: 14px;">Receba via PIX em tempo real</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height: 12px;"></td></tr>
        <tr>
          <td style="padding: 15px; background: rgba(6, 182, 212, 0.1); border-radius: 16px; border: 1px solid rgba(6, 182, 212, 0.2);">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td width="50" valign="top">
                  <span style="font-size: 28px;">📊</span>
                </td>
                <td>
                  <h3 style="margin: 0 0 5px; color: #ffffff; font-size: 16px; font-weight: 600;">Analytics Completo</h3>
                  <p style="margin: 0; color: #71717a; font-size: 14px;">Acompanhe seus ganhos e engajamento</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Important Notice -->
      <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 30px;">
        <p style="margin: 0; color: #86efac; font-size: 14px; text-align: center;">
          💡 <strong>Dica importante:</strong> Configure sua chave PIX no Dashboard para começar a receber pagamentos!
        </p>
      </div>

      <!-- Button -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <a href="${env.FRONTEND_URL}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(236, 72, 153, 0.4);">
              Acessar meu Dashboard
            </a>
          </td>
        </tr>
      </table>
    </td>
  `;
  return baseTemplate(content);
}

export function paymentConfirmedTemplate(name: string, amount: string, description: string): string {
  const content = `
    <!-- Icon -->
    <td align="center" style="padding: 40px 40px 20px;">
      <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px;">✅</span>
      </div>
    </td>
  </tr>
  <tr>
    <td style="padding: 0 40px 40px;">
      <h2 style="margin: 0 0 15px; color: #ffffff; font-size: 28px; font-weight: 700; text-align: center;">
        Pagamento Confirmado!
      </h2>
      <p style="margin: 0 0 30px; color: #a1a1aa; font-size: 16px; line-height: 1.7; text-align: center;">
        Olá${name ? ` <strong style="color: #ffffff;">${name}</strong>` : ''}! Seu pagamento foi processado com sucesso.
      </p>

      <!-- Payment Details Card -->
      <div style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 25px; margin-bottom: 30px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom: 15px; border-bottom: 1px solid rgba(34, 197, 94, 0.2);">
              <p style="margin: 0 0 5px; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Valor pago</p>
              <p style="margin: 0; color: #22c55e; font-size: 32px; font-weight: 700;">${amount}</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 15px;">
              <p style="margin: 0 0 5px; color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Descrição</p>
              <p style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 500;">${description}</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Info -->
      <p style="margin: 0 0 25px; color: #71717a; font-size: 14px; text-align: center; line-height: 1.6;">
        Você já pode acessar o conteúdo adquirido na plataforma. Aproveite!
      </p>

      <!-- Button -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <a href="${env.FRONTEND_URL}/feed" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #10b981 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);">
              Ver meu conteúdo
            </a>
          </td>
        </tr>
      </table>
    </td>
  `;
  return baseTemplate(content);
}
