const EMPTY_ALLOWLIST_ERROR =
  'CORS allowed origins must contain at least one URL';

export function parseCorsAllowedOrigins(
  configuredOrigins: string | undefined,
  frontendUrl: string | undefined,
): string[] {
  const source =
    configuredOrigins === undefined ? frontendUrl : configuredOrigins;

  if (typeof source !== 'string' || source.trim().length === 0) {
    throw new Error(EMPTY_ALLOWLIST_ERROR);
  }

  const values = source
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (values.length === 0) {
    throw new Error(EMPTY_ALLOWLIST_ERROR);
  }

  const origins = values.map((value) => {
    if (value.includes('*')) {
      throw new Error('CORS allowed origins must not contain wildcard');
    }

    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new Error('CORS allowed origin must be a valid URL');
    }

    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.origin === 'null'
    ) {
      throw new Error('CORS allowed origin must use HTTP or HTTPS');
    }

    return url.origin;
  });

  return [...new Set(origins)];
}
