import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile || Buffer.isBuffer(data)) {
          return data;
        }

        return {
          success: true,
          data: data,
          timestamp: new Date(),
          path: request.url,
        };
      }),
    );
  }
}
