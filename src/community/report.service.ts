import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ReportType } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';

import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async createReport(reporterId: string, dto: CreateReportDto) {
    const targetCount = [dto.communityPostId, dto.commentId].filter(
      Boolean,
    ).length;

    if (targetCount !== 1) {
      throw new BadRequestException(
        'Provide exactly one communityPostId or commentId',
      );
    }

    if (dto.reportType === ReportType.POST && !dto.communityPostId) {
      throw new BadRequestException('POST reports require communityPostId');
    }

    if (dto.reportType === ReportType.COMMENT && !dto.commentId) {
      throw new BadRequestException('COMMENT reports require commentId');
    }

    if (dto.communityPostId) {
      const post = await this.prisma.communityPost.findFirst({
        where: {
          id: dto.communityPostId,
          isHidden: false,
        },
        select: {
          id: true,
        },
      });

      if (!post) {
        throw new NotFoundException('Community post not found');
      }
    }

    if (dto.commentId) {
      const comment = await this.prisma.communityComment.findFirst({
        where: {
          id: dto.commentId,
          isHidden: false,
          communityPost: {
            is: {
              isHidden: false,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!comment) {
        throw new NotFoundException('Community comment not found');
      }
    }

    return this.prisma.contentReport.create({
      data: {
        reporterId,
        reportType: dto.reportType,
        communityPostId: dto.communityPostId ?? null,
        commentId: dto.commentId ?? null,
        reason: dto.reason,
      },
    });
  }
}
