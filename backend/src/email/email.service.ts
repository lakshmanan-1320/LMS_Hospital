
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { decryptSecret } from '../modules/sms/utils/secret-box';
import * as nodemailer from 'nodemailer';
import type {
  Transporter,
  SendMailOptions,
} from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private cachedFromEmail: string | null = null;
  private cachedFromName: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly databaseService?: DatabaseService,
  ) {}

  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    let host = this.configService.get<string>('SMTP_HOST');
    let port = this.configService.get<number>('SMTP_PORT');
    let user = this.configService.get<string>('SMTP_USER');
    let pass = this.configService.get<string>('SMTP_PASS');
    let secure = Number(port) === 465;

    // Database fallback: Read active Email Gateway configuration from PostgreSQL
    if ((!host || !port || !user || !pass) && this.databaseService) {
      try {
        const res = await this.databaseService.executeQuery<any>(
          `SELECT host, port, encryption, username, password_encrypted, from_name, from_email
           FROM email_configs
           ORDER BY updated_at DESC NULLS LAST, created_at DESC
           LIMIT 1;`,
        );
        if (res.rows.length > 0) {
          const cfg = res.rows[0];
          host = cfg.host;
          port = Number(cfg.port);
          user = cfg.username;
          pass = decryptSecret(cfg.password_encrypted) || cfg.password_encrypted;
          secure = cfg.encryption === 'ssl' || port === 465;
          this.cachedFromEmail = cfg.from_email;
          this.cachedFromName = cfg.from_name;
          this.logger.log(`Loaded SMTP transport from Database Email Gateway: ${host}:${port} (${user})`);
        }
      } catch (dbErr: any) {
        this.logger.warn(`Could not read database email_configs: ${dbErr.message}`);
      }
    }

    if (!host || !port || !user || !pass) {
      throw new InternalServerErrorException(
        'Email service is not configured. Please configure Email Gateway in Super Admin settings.',
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    return this.transporter;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      this.logger.log('SMTP connection verified successfully.');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection verification failed.');
      return false;
    }
  }

  clearCache(): void {
    this.transporter = null;
    this.cachedFromEmail = null;
    this.cachedFromName = null;
    this.logger.log('EmailService transporter cache reset.');
  }

  async sendEmail(options: SendMailOptions): Promise<void> {
    const transporter = await this.getTransporter();
    
    // Always prioritize the authenticated Email Gateway sender to avoid SMTP relay rejection
    const gatewayFrom = this.cachedFromEmail
      ? (this.cachedFromName ? `"${this.cachedFromName}" <${this.cachedFromEmail}>` : this.cachedFromEmail)
      : (this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER'));

    const sender = gatewayFrom || options.from;

    if (!sender) {
      throw new InternalServerErrorException(
        'Email sender address is not configured. Please configure Email Gateway in Super Admin settings.',
      );
    }

    try {
      await transporter.sendMail({
        ...options,
        from: sender,
      });

      this.logger.log(`Email sent to ${options.to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send email: ${error.message}`);

      throw new InternalServerErrorException(
        `Unable to send email: ${error.message}`,
      );
    }
  }

  /**
   * Send a real-time verification OTP email to a user
   */
  async sendVerificationOtp(email: string, otp: string, firstName?: string): Promise<void> {
    const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background-color: #4f46e5; padding: 28px 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">elevate<span style="color: #a5b4fc;">.</span></h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e0e7ff; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 600;">Account Verification</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 12px;">${greeting}</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
              Thank you for registering with Elevate LMS! Please use the 6-digit verification code below to verify your email address and activate your account.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <div style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #4f46e5; border-radius: 12px; padding: 14px 28px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">
                ${otp}
              </div>
              <p style="font-size: 13px; color: #64748b; margin: 12px 0 0;">
                ⏱ This code is valid for <strong>10 minutes</strong>.
              </p>
            </div>
            <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 24px 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              If you did not register for an Elevate account, please ignore this email or contact support if you have concerns.
            </p>
          </div>
          <div style="padding: 18px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
            &copy; ${new Date().getFullYear()} Elevate LMS. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `${greeting}\n\nThank you for registering with Elevate LMS! Your 6-digit verification code is:\n\n${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not initiate this request, you can safely disregard this email.\n\nElevate LMS`;

    await this.sendEmail({
      to: email,
      subject: `Your Elevate Verification Code: ${otp}`,
      html,
      text,
    });
  }

  /**
   * Send a one-time password reset link (from POST /auth/forgot-password).
   */
  async sendPasswordResetLink(email: string, resetUrl: string, validMinutes: number, firstName?: string): Promise<void> {
    const greeting = firstName ? `Hi ${firstName},` : 'Hello,';
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your password</title>
      </head>
      <body style="margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
        <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background-color: #4f46e5; padding: 28px 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">elevate<span style="color: #a5b4fc;">.</span></h1>
            <p style="margin: 6px 0 0; font-size: 13px; color: #e0e7ff; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 600;">Password Reset</p>
          </div>
          <div style="padding: 32px 28px;">
            <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 12px;">${greeting}</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
              We received a request to reset the password for your Elevate account. Click the button below to choose a new password.
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 10px;">Reset password</a>
              <p style="font-size: 13px; color: #64748b; margin: 12px 0 0;">
                ⏱ This link is valid for <strong>${validMinutes} minutes</strong> and can be used once.
              </p>
            </div>
            <p style="font-size: 12px; line-height: 1.6; color: #94a3b8; margin: 0; word-break: break-all;">
              If the button doesn't work, copy this link into your browser:<br>${resetUrl}
            </p>
            <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 24px 0 0; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              If you didn't ask to reset your password, you can ignore this email. Your password won't change.
            </p>
          </div>
          <div style="padding: 18px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
            &copy; ${new Date().getFullYear()} Elevate LMS. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `${greeting}\n\nWe received a request to reset the password for your Elevate account. Open this link to choose a new password:\n\n${resetUrl}\n\nThe link is valid for ${validMinutes} minutes and can be used once.\n\nIf you didn't ask to reset your password, you can ignore this email.\n\nElevate LMS`;

    await this.sendEmail({
      to: email,
      subject: 'Reset your Elevate password',
      html,
      text,
    });
  }
}
