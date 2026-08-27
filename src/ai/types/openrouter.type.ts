import OpenAI from 'openai';

export type OpenRouterChatCompletion =
  OpenAI.Chat.Completions.ChatCompletion & {
    provider?: string;

    usage?: OpenAI.CompletionUsage & {
      cost?: number;
    };

    // OpenRouter can respond with HTTP 200 and this shape instead of
    // throwing (e.g. moderation rejection, upstream provider failure).
    error?: {
      message?: string;
      code?: number | string;
    };
  };
