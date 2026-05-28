import { BrevoClient } from '@getbrevo/brevo';

/**
 * Email service using Brevo (formerly Sendinblue).
 *
 * No custom domain required — just verify your sender email address
 * in the Brevo dashboard (Senders & IP → Senders).
 *
 * Setup:
 *   1. Create free account at https://app.brevo.com
 *   2. Go to SMTP & API → API Keys → Generate new key
 *   3. Go to Senders & IP → Senders → Add your Gmail → click verify link
 *   4. Set these env vars in Railway:
 *        BREVO_API_KEY=your_api_key
 *        EMAIL_FROM=yourname@gmail.com
 *        EMAIL_FROM_NAME=Aura
 *        APP_URL=https://your-railway-url.up.railway.app
 */

function getClient(): BrevoClient {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not set. Add it to your Railway environment variables.');
  }
  return new BrevoClient({ apiKey });
}

/**
 * Send an email verification link to a newly registered user.
 */
export async function sendVerificationEmail(
  toEmail: string,
  displayName: string,
  token: string
): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;
  const fromEmail = process.env.EMAIL_FROM ?? 'noreply@example.com';
  const fromName = process.env.EMAIL_FROM_NAME ?? 'Aura';

  const client = getClient();

  await client.transactionalEmails.sendTransacEmail({
    subject: 'Verify your Aura account',
    sender: { name: fromName, email: fromEmail },
    to: [{ email: toEmail, name: displayName }],
    htmlContent: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6C63FF;">Welcome to Aura, ${displayName}!</h2>
        <p>Click the button below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}"
           style="display: inline-block; background: #6C63FF; color: white;
                  padding: 12px 24px; border-radius: 8px; text-decoration: none;
                  font-weight: bold; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #888; font-size: 13px;">
          This link expires in 24 hours. If you didn't create an Aura account, ignore this email.
        </p>
        <p style="color: #888; font-size: 12px;">
          Or copy this link: ${verifyUrl}
        </p>
      </div>
    `,
  });
}

/**
 * Send a password reset email.
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  displayName: string,
  token: string
): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
  const fromEmail = process.env.EMAIL_FROM ?? 'noreply@example.com';
  const fromName = process.env.EMAIL_FROM_NAME ?? 'Aura';

  const client = getClient();

  await client.transactionalEmails.sendTransacEmail({
    subject: 'Reset your Aura password',
    sender: { name: fromName, email: fromEmail },
    to: [{ email: toEmail, name: displayName }],
    htmlContent: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6C63FF;">Reset your password</h2>
        <p>Hi ${displayName}, click below to reset your Aura password.</p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #6C63FF; color: white;
                  padding: 12px 24px; border-radius: 8px; text-decoration: none;
                  font-weight: bold; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #888; font-size: 13px;">
          This link expires in 1 hour. If you didn't request a reset, ignore this email.
        </p>
      </div>
    `,
  });
}
