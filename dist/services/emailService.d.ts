/**
 * Send an email verification link to a newly registered user.
 */
export declare function sendVerificationEmail(toEmail: string, displayName: string, token: string): Promise<void>;
/**
 * Send a password reset email.
 */
export declare function sendPasswordResetEmail(toEmail: string, displayName: string, token: string): Promise<void>;
//# sourceMappingURL=emailService.d.ts.map