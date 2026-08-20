export interface OpenRouterImageResponse {
  created?: number;

  data: Array<{
    b64_json: string;
  }>;
}
