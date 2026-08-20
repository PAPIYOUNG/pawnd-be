import OpenAI from 'openai';

export type OpenRouterChatCompletion =
  OpenAI.Chat.Completions.ChatCompletion & {
    provider?: string;

    usage?: OpenAI.CompletionUsage & {
      cost?: number;
    };
  };
