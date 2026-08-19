import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { EnvVariableType } from '@/config/env.validate';

@Injectable()
export class GoogleAuthService {
  private readonly client: OAuth2Client;

  constructor(
    private readonly configService: ConfigService<EnvVariableType, true>,
  ) {
    this.client = new OAuth2Client(
      this.configService.get('GOOGLE_CLIENT_ID', { infer: true }),
    );
  }

  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.configService.get('GOOGLE_CLIENT_ID', { infer: true }),
    });

    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Invalid Google token');
    }

    return payload;
  }
}
