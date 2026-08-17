import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    //code run before pipe
    const path = context.switchToHttp().getRequest<Request>();
    //code run strem response
    return next.handle().pipe(
      map((data: unknown) => ({
        success: true,
        data: data,
        timestamp: new Date(),
        path: path.url,
      })),
    );
  }
}
