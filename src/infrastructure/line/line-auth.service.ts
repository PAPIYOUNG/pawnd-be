import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvVariableType } from '@/config/env.validate';

interface LineTokenResponse {
  access_token: string;
  id_token: string;
}

interface LineProfile {
  sub: string;
  name?: string;
  picture?: string;
  email?: string;
}

@Injectable()
export class LineAuthService {
  constructor(
    private readonly configService: ConfigService<EnvVariableType, true>,
  ) {}

  async verifyCode(code: string, redirectUri: string): Promise<LineProfile> {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.configService.get('LINE_CHANNEL_ID', {
          infer: true,
        }),
        client_secret: this.configService.get('LINE_CHANNEL_SECRET', {
          infer: true,
        }),
      }),
    });

    if (!tokenRes.ok) {
      throw new UnauthorizedException('Invalid LINE authorization code');
    }

    const tokenData = (await tokenRes.json()) as LineTokenResponse;

    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: tokenData.id_token,
        client_id: this.configService.get('LINE_CHANNEL_ID', {
          infer: true,
        }),
      }),
    });

    if (!verifyRes.ok) {
      throw new UnauthorizedException('Invalid LINE token');
    }

    return (await verifyRes.json()) as LineProfile;
  }
}
