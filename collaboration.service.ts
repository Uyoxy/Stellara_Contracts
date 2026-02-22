import { Injectable } from '@nestjs/common';
import { UserPresence, RoomState } from './interfaces/collaboration.interface';

@Injectable()
export class CollaborationService {
  // In-memory storage for MVP. In production, use Redis for scalability.
  private rooms: Map<string, RoomState> = new Map();

  createRoom(roomId: string, initialContent: string = ''): RoomState {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        users: {},
        content: initialContent,
        version: 0,
        operations: [],
      });
    }
    return this.rooms.get(roomId)!;
  }

  joinRoom(roomId: string, clientId: string, userId: string, username: string): RoomState {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }

    const color = this.generateRandomColor();
    room.users[clientId] = {
      clientId,
      userId,
      username,
      color,
      connectedAt: new Date(),
    };

    return room;
  }

  leaveRoom(roomId: string, clientId: string): void {
    const room = this.rooms.get(roomId);
    if (room && room.users[clientId]) {
      delete room.users[clientId];
      // Optional: Clean up empty rooms or persist state to DB here
    }
  }

  updateCursor(roomId: string, clientId: string, position: any): void {
    const room = this.rooms.get(roomId);
    if (room && room.users[clientId]) {
      room.users[clientId].cursor = position;
    }
  }

  // Handles operational transformation / edit application
  applyEdit(roomId: string, edit: { version: number; operation: any }, clientId: string): { success: boolean; room: RoomState | null; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, room: null, error: 'Room not found' };

    // Basic Optimistic Concurrency Control
    // In a full OT system, we would transform 'edit.operation' against concurrent ops here.
    if (edit.version !== room.version) {
      return { success: false, room, error: 'Version mismatch' };
    }

    room.operations.push({
      clientId,
      op: edit.operation,
      timestamp: new Date(),
    });
    
    room.version++;
    // Note: Actual content string mutation would happen here based on the operation type

    return { success: true, room };
  }

  getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId);
  }

  private generateRandomColor(): string {
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF5', '#FF33A8', '#33FFF2'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}