import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EnvVariableType } from '@/config/env.validate';

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor(configService: ConfigService<EnvVariableType, true>) {
    this.resend = new Resend(
      configService.get('RESEND_API_KEY', { infer: true }),
    );
    this.fromEmail = configService.get('RESEND_FROM_EMAIL', { infer: true });
  }

  async send(payload: MailPayload): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });

    if (error) {
      this.logger.error(
        `Failed to send email to ${payload.to}: ${error.message}`,
      );
      throw new Error('Failed to send email');
    }
  }
}
