import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { PostflopService } from './postflop.service.js';

@ApiTags('postflop')
@ApiBearerAuth()
@Controller('strategy/postflop')
@UseGuards(JwtAuthGuard)
export class PostflopController {
  constructor(private readonly postflop: PostflopService) {}

  @Get('trees')
  @Header('Cache-Control', 'private, no-store')
  trees(
    @Query('format') format: string,
    @Query('valuation') valuation: string,
    @Query('street') street: string,
    @Query('tableSize') tableSize: string,
  ) {
    return this.postflop.listTrees({ format, valuation, street, tableSize: Number(tableSize) });
  }

  @Get('node')
  @Header('Cache-Control', 'private, no-store')
  node(@Query('nodeId') nodeId: string) {
    return this.postflop.getNode(nodeId);
  }
}
