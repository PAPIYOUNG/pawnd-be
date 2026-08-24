import { AccessTokenService } from '@/infrastructure/jwt/access-token.service';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;

  const accessTokenService = {
    verify: jest.fn(),
  };
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const createContext = (request: Request): ExecutionContext =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class TestController {},
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    jest.resetAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: AccessTokenService, useValue: accessTokenService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(AuthGuard);
  });

  it('propagates inactive-account errors without assigning request.user', async () => {
    const request = {
      headers: { authorization: 'Bearer valid-token' },
    } as Request;
    accessTokenService.verify.mockRejectedValue(
      new UnauthorizedException('Account is not active'),
    );

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      new UnauthorizedException('Account is not active'),
    );
    expect(request.user).toBeUndefined();
  });

  it('allows public endpoints without checking a token or the database-backed validator', async () => {
    const request = { headers: {} } as Request;
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(accessTokenService.verify).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });
});
