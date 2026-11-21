import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { htmlToPlainText } from '../utils/email-template.utils';

export interface SmtpConnectionOptions {
  host: string;
  port: number;
  encryption: 'ssl' | 'tls' | 'none';
  username: string;
  password?: string;
  from_name: string;
  from_email: string;
  redirect_to?: string | null;
}

export interface SendMailItem {
  to: string;
  recipientName?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  actualDeliveredTo: string;
}

@Injectable()
export class EmailSmtpProvider {
  private readonly logger = new Logger(EmailSmtpProvider.name);

  buildTransporter(options: SmtpConnectionOptions): Transporter {
    const port = Number(options.port);
    const isSsl = options.encryption === 'ssl' || port === 465;
    return nodemailer.createTransport({
      host: options.host,
      port,
      secure: isSsl,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: options.username
        ? {
            user: options.username,
            pass: options.password || '',
          }
        : undefined,
      tls: {
        rejectUnauthorized: false, // Prevents self-signed cert blocks in internal relay servers
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });
  }

  async verifyConnection(options: SmtpConnectionOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const port = Number(options.port);
      const isSsl = options.encryption === 'ssl' || port === 465;
      const transporter = nodemailer.createTransport({
        host: options.host,
        port,
        secure: isSsl,
        auth: options.username
          ? {
              user: options.username,
              pass: options.password || '',
            }
          : undefined,
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000,
      });

      await transporter.verify();
      this.logger.log(`SMTP connection verified successfully for ${options.host}:${port}`);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`SMTP connection verification failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async sendSingle(
    options: SmtpConnectionOptions,
    item: SendMailItem,
  ): Promise<SendMailResult> {
    const transporter = this.buildTransporter(options);

    // Development safety redirection (from Unified-CRM pattern)
    const isProd = process.env.NODE_ENV === 'production';
    const hasRedirect = Boolean(options.redirect_to && options.redirect_to.trim().length > 0);
    const actualRecipient = !isProd && hasRedirect ? options.redirect_to!.trim() : item.to;
    const finalSubject = !isProd && hasRedirect ? `[DEV Redirect: ${item.to}] ${item.subject}` : item.subject;

    try {
      const info = await transporter.sendMail({
        from: `"${options.from_name}" <${options.from_email}>`,
        to: actualRecipient,
        subject: finalSubject,
        html: item.html,
        text: item.text || htmlToPlainText(item.html),
      });

      return {
        success: true,
        messageId: info.messageId,
        actualDeliveredTo: actualRecipient,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'SMTP dispatch error',
        actualDeliveredTo: actualRecipient,
      };
    }
  }
}

