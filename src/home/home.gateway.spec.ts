import { Test, TestingModule } from '@nestjs/testing';
import { HomeGateway } from './home.gateway';
import { HomeService } from './home.service';
import { Server, Socket } from 'socket.io';

describe('HomeGateway', () => {
  let gateway: HomeGateway;

  const mockHomeService = {
    getSummaryStats: jest.fn(),
  };

  const mockServer = {
    emit: jest.fn(),
  } as unknown as Server;

  const mockSocket = {
    id: 'socket-client-1',
    emit: jest.fn(),
  } as unknown as Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeGateway,
        {
          provide: HomeService,
          useValue: mockHomeService,
        },
      ],
    }).compile();

    gateway = module.get<HomeGateway>(HomeGateway);
    gateway.server = mockServer;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should emit stats_update to newly connected client', async () => {
      const mockStatsResult = {
        stats: {
          totalLost: 100,
          totalFound: 50,
          totalReunited: 30,
          totalUsers: 200,
        },
      };

      mockHomeService.getSummaryStats.mockResolvedValue(mockStatsResult);

      await gateway.handleConnection(mockSocket);

      expect(mockHomeService.getSummaryStats).toHaveBeenCalledTimes(1);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'stats_update',
        mockStatsResult.stats,
      );
    });
  });

  describe('handleSubscribe', () => {
    it('should return subscription confirmation and emit stats_update', async () => {
      const mockStatsResult = {
        stats: {
          totalLost: 100,
          totalFound: 50,
          totalReunited: 30,
          totalUsers: 200,
        },
      };

      mockHomeService.getSummaryStats.mockResolvedValue(mockStatsResult);

      const response = await gateway.handleSubscribe(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'stats_update',
        mockStatsResult.stats,
      );
      expect(response).toEqual({
        event: 'subscribed',
        data: mockStatsResult.stats,
      });
    });
  });

  describe('broadcastStatsUpdate', () => {
    it('should fetch stats and emit stats_update to all clients on server', async () => {
      const mockStatsResult = {
        stats: {
          totalLost: 105,
          totalFound: 55,
          totalReunited: 35,
          totalUsers: 210,
        },
      };

      mockHomeService.getSummaryStats.mockResolvedValue(mockStatsResult);

      await gateway.broadcastStatsUpdate();

      expect(mockHomeService.getSummaryStats).toHaveBeenCalledTimes(1);
      expect(mockServer.emit).toHaveBeenCalledWith(
        'stats_update',
        mockStatsResult.stats,
      );
    });
  });

  describe('broadcastNewPostAlert', () => {
    it('should emit new_post_alert event to server', () => {
      const payload = {
        id: 'post-1',
        type: 'LOST',
        petName: 'Bella',
        petType: 'DOG',
        province: 'Bangkok',
        coverImageUrl: 'https://cloudinary.com/bella.jpg',
        createdAt: new Date(),
      };

      gateway.broadcastNewPostAlert(payload);

      expect(mockServer.emit).toHaveBeenCalledWith('new_post_alert', payload);
    });
  });

  describe('broadcastReunitedAlert', () => {
    it('should emit reunited_alert event to server', () => {
      const payload = {
        id: 'post-2',
        petName: 'Milo',
        petType: 'CAT',
        province: 'Chiang Mai',
        reunitedAt: new Date(),
        coverImageUrl: 'https://cloudinary.com/milo.jpg',
      };

      gateway.broadcastReunitedAlert(payload);

      expect(mockServer.emit).toHaveBeenCalledWith('reunited_alert', payload);
    });
  });
});
