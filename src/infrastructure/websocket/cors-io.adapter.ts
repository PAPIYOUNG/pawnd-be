import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: readonly string[],
  ) {
    super(app);
  }

  createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    const mergedOptions: Partial<ServerOptions> = {
      ...options,
      cors: {
        ...options?.cors,
        origin: [...this.allowedOrigins],
      },
    };

    return super.createIOServer(port, mergedOptions) as Server;
  }
}
