export type OpenRouterEmbeddingResponse = {
  id?: string;

  object: 'list';

  model: string;

  data: Array<{
    object: 'embedding';
    index: number;
    embedding: number[];
  }>;

  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
};
