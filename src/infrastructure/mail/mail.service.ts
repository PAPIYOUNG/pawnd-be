import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { EnvVariableType } from '@/config/env.validate';

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly fromEmail: string;

  constructor(configService: ConfigService<EnvVariableType, true>) {
    const user = configService.get('GMAIL_SMTP_USER', { infer: true });
    this.fromEmail = user;
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass: configService.get('GMAIL_SMTP_APP_PASSWORD', { infer: true }),
      },
    });
  }

  async send(payload: MailPayload): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${payload.to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new Error('Failed to send email');
    }
  }
}
