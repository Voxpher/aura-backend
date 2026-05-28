/**
 * Send an email verification link to a newly registered user.
 *
 * @param toEmail     - The user's email address
 * @param displayName - The user's display name (used in the email greeting)
 * @param token       - The verification token to embed in the link
 */
export declare function sendVerificationEmail(toEmail: string, displayName: string, token: string): Promise<void>;
/**
 * Send a password reset email.
 * (Placeholder — implement when needed)
 */
export declare function sendPasswordResetEmail(toEmail: string, displayName: string, token: string): Promise<void>;
//# sourceMappingURL=emailService.d.ts.map