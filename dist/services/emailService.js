"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = exports.sendVerificationEmail = void 0;
const resend_1 = require("resend");
let resend = null;
function getResend() {
    if (!resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error('RESEND_API_KEY is not set. Add it to your .env file.');
        }
        resend = new resend_1.Resend(apiKey);
    }
    return resend;
}
/**
 * Send an email verification link to a newly registered user.
 *
 * @param toEmail     - The user's email address
 * @param displayName - The user's display name (used in the email greeting)
 * @param token       - The verification token to embed in the link
 */
async function sendVerificationEmail(toEmail, displayName, token) {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;
    await getResend().emails.send({
        from: 'Aura <noreply@yourdomain.com>', // ← replace with your verified Resend domain
        to: toEmail,
        subject: 'Verify your Aura account',
        html: `
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
exports.sendVerificationEmail = sendVerificationEmail;
/**
 * Send a password reset email.
 * (Placeholder — implement when needed)
 */
async function sendPasswordResetEmail(toEmail, displayName, token) {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
    await getResend().emails.send({
        from: 'Aura <noreply@yourdomain.com>',
        to: toEmail,
        subject: 'Reset your Aura password',
        html: `
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
exports.sendPasswordResetEmail = sendPasswordResetEmail;
//# sourceMappingURL=emailService.js.map