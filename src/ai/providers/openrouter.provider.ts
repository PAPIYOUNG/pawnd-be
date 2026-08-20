import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenRouterProvider {
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.client = new OpenAI({
      baseURL: this.configService.getOrThrow<string>('OPENROUTER_BASE_URL'),
      apiKey: this.configService.getOrThrow<string>('OPENROUTER_API_KEY'),
      defaultHeaders: {
        'X-OpenRouter-Title': 'PAWND',
      },
    });
  }

  getClient() {
    return this.client;
  }
}
