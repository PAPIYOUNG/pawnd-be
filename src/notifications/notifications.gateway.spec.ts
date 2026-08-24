import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';
import { Test, TestingModule } from '@nestjs/testing';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';
import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        {
          provide: AccessTokenService,
          useValue: { verify: jest.fn() },
        },
      ],
    }).compile();

    gateway = module.get(NotificationsGateway);
  });

  it('uses the centralized Socket.IO CORS policy without gateway wildcard options', () => {
    const options = Reflect.getMetadata(GATEWAY_OPTIONS, NotificationsGateway);

    expect(gateway).toBeDefined();
    expect(options).toEqual({ namespace: '/notifications' });
    expect(JSON.stringify(options)).not.toContain('*');
  });
});
