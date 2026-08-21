import { parseCorsAllowedOrigins } from './cors.config';

describe('parseCorsAllowedOrigins', () => {
  it('parses a single origin', () => {
    expect(parseCorsAllowedOrigins('http://localhost:3001', undefined)).toEqual(
      ['http://localhost:3001'],
    );
  });

  it('parses multiple comma-separated origins', () => {
    expect(
      parseCorsAllowedOrigins(
        'http://localhost:3001,https://pawnd.example.com',
        undefined,
      ),
    ).toEqual(['http://localhost:3001', 'https://pawnd.example.com']);
  });

  it('trims and deduplicates origins', () => {
    expect(
      parseCorsAllowedOrigins(
        ' http://localhost:3001 , http://localhost:3001 ',
        undefined,
      ),
    ).toEqual(['http://localhost:3001']);
  });

  it('normalizes URLs with paths to their origin', () => {
    expect(
      parseCorsAllowedOrigins(
        'https://pawnd.example.com/app/dashboard?tab=chat',
        undefined,
      ),
    ).toEqual(['https://pawnd.example.com']);
  });

  it('falls back to FRONTEND_URL when the allowlist is undefined', () => {
    expect(
      parseCorsAllowedOrigins(undefined, 'http://localhost:3001/app'),
    ).toEqual(['http://localhost:3001']);
  });

  it('rejects wildcard origins', () => {
    expect(() =>
      parseCorsAllowedOrigins('http://localhost:3001,*', undefined),
    ).toThrow('CORS allowed origins must not contain wildcard');
  });

  it('rejects invalid URLs without exposing the supplied value', () => {
    const invalidOrigin = 'not-a-valid-origin';

    expect(() => parseCorsAllowedOrigins(invalidOrigin, undefined)).toThrow(
      'CORS allowed origin must be a valid URL',
    );

    try {
      parseCorsAllowedOrigins(invalidOrigin, undefined);
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(invalidOrigin);
    }
  });

  it.each([
    'file:///tmp/index.html',
    'javascript:alert(1)',
    'ftp://example.com',
    'data:text/plain,opaque-origin',
  ])(
    'rejects non-HTTP origins without exposing the supplied value',
    (unsupportedOrigin) => {
      try {
        parseCorsAllowedOrigins(unsupportedOrigin, undefined);
        throw new Error('Expected parser to reject unsupported origin');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(
          'CORS allowed origin must use HTTP or HTTPS',
        );
        expect((error as Error).message).not.toContain(unsupportedOrigin);
      }
    },
  );

  it.each([
    ['', 'http://localhost:3001'],
    ['  ,  ', 'http://localhost:3001'],
    [undefined, ''],
    [undefined, undefined],
  ])('rejects an empty effective allowlist', (configured, fallback) => {
    expect(() => parseCorsAllowedOrigins(configured, fallback)).toThrow(
      'CORS allowed origins must contain at least one URL',
    );
  });
});
