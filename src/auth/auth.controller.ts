import { Public } from '@/common/decorators/public.decorator';
import { Controller, Post } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Public()
  @Post('/hello')
  postHello() {
    console.log('first');
    return { message: 'dfsdfsd' };
  }
}
