import { Test, TestingModule } from '@nestjs/testing';

import { CreateReportDto } from './dto/create-report.dto';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

describe('ReportController', () => {
  let controller: ReportController;

  const mockReportService = {
    createReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportController],
      providers: [
        {
          provide: ReportService,
          useValue: mockReportService,
        },
      ],
    }).compile();

    controller = module.get<ReportController>(ReportController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createReport', async () => {
    const dto: CreateReportDto = {
      reportType: 'POST',
      communityPostId: 'post-id',
      reason: 'Inappropriate content',
    };

    const response = {
      id: 'report-id',
    };

    mockReportService.createReport.mockResolvedValue(response);

    const result = await controller.reportContent('user-id', dto);

    expect(mockReportService.createReport).toHaveBeenCalledWith('user-id', dto);

    expect(result).toEqual(response);
  });
});
