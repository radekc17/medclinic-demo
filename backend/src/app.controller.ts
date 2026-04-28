// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Status')
@Controller()
export class AppController {
  
  @Get()
  @ApiOperation({ summary: 'Sprawdzenie czy serwer działa' })
  getHello(): string {
    return 'Serwer NestJS działa!';
  }
}