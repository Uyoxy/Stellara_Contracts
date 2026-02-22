import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CollaborationService } from './collaboration.service';
import { JoinRoomDto, EditDocumentDto, CursorMoveDto, LeaveRoomDto } from './dto/collaboration.dto';

@WebSocketGateway({
  namespace: 'collaboration',
  cors: {
    origin: '*',
  },
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly collaborationService: CollaborationService) {}

  handleConnection(client: Socket) {
    // Connection handling
  }

  handleDisconnect(client: Socket) {
    // Cleanup logic would go here
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @MessageBody() payload: JoinRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    const { roomId, username } = payload;
    // In production, extract userId from JWT in handshake
    const userId = client.handshake.auth.userId || `user-${client.id.substr(0, 4)}`;
    
    const room = this.collaborationService.joinRoom(roomId, client.id, userId, username);
    
    client.join(roomId);
    
    // Notify others in the room
    client.to(roomId).emit('user-joined', {
      userId,
      username,
      clientId: client.id,
      color: room.users[client.id].color,
    });

    // Send current state to the joining user
    return { event: 'room-state', data: room };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @MessageBody() payload: LeaveRoomDto,
    @ConnectedSocket() client: Socket,
  ) {
    this.collaborationService.leaveRoom(payload.roomId, client.id);
    client.leave(payload.roomId);
    client.to(payload.roomId).emit('user-left', { clientId: client.id });
  }

  @SubscribeMessage('edit-document')
  handleEditDocument(
    @MessageBody() payload: EditDocumentDto,
    @ConnectedSocket() client: Socket,
  ) {
    const result = this.collaborationService.applyEdit(payload.roomId, payload, client.id);
    
    if (result.success) {
      // Broadcast the operation to others
      client.to(payload.roomId).emit('document-edited', {
        clientId: client.id,
        operation: payload.operation,
        version: result.room!.version,
      });
      return { event: 'edit-ack', data: { version: result.room!.version } };
    } else {
      return { event: 'edit-error', data: { message: result.error, room: result.room } };
    }
  }

  @SubscribeMessage('cursor-move')
  handleCursorMove(@MessageBody() payload: CursorMoveDto, @ConnectedSocket() client: Socket) {
    this.collaborationService.updateCursor(payload.roomId, client.id, payload.position);
    client.to(payload.roomId).emit('cursor-moved', {
      clientId: client.id,
      position: payload.position,
    });
  }
}