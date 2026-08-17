import { Injectable, Logger } from '@nestjs/common';

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(payload: MailPayload): Promise<void> {
    this.logger.log(
      `[MailService placeholder] to=${payload.to} subject="${payload.subject}"\n${payload.text}`,
    );
  }
}
