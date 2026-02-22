import { Controller, Get, Param } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';

@Controller('collaboration')
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Get('rooms/:roomId')
  getRoomState(@Param('roomId') roomId: string) {
    return this.collaborationService.getRoom(roomId);
  }
}