import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import { CorsIoAdapter } from './cors-io.adapter';

describe('CorsIoAdapter', () => {
  const allowedOrigins = ['http://localhost:3001', 'https://pawnd.example.com'];
  const server = {} as Server;
  let createServerSpy: jest.SpyInstance;
  let adapter: CorsIoAdapter;

  beforeEach(() => {
    createServerSpy = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue(server);
    adapter = new CorsIoAdapter({} as INestApplicationContext, allowedOrigins);
  });

  afterEach(() => {
    createServerSpy.mockRestore();
  });

  it('applies the centralized origin allowlist', () => {
    expect(adapter.createIOServer(0)).toBe(server);
    expect(createServerSpy).toHaveBeenCalledWith(0, {
      cors: { origin: allowedOrigins },
    });
  });

  it('does not allow gateway-supplied wildcard CORS to override the allowlist', () => {
    adapter.createIOServer(0, {
      cors: { origin: '*', methods: ['GET'], credentials: true },
    });

    expect(createServerSpy).toHaveBeenCalledWith(0, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET'],
        credentials: true,
      },
    });
  });

  it('preserves other Socket.IO server options', () => {
    const options: Partial<ServerOptions> = {
      path: '/custom-socket-path',
      pingTimeout: 15_000,
      transports: ['websocket'],
    };

    adapter.createIOServer(3000, options);

    expect(createServerSpy).toHaveBeenCalledWith(3000, {
      ...options,
      cors: { origin: allowedOrigins },
    });
  });
});
