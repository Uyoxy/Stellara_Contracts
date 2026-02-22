export class JoinRoomDto {
  roomId: string;
  username: string;
}

export class LeaveRoomDto {
  roomId: string;
}

export class EditDocumentDto {
  roomId: string;
  version: number;
  operation: any; // JSON representation of the operation (e.g., OT or CRDT delta)
}

export class CursorMoveDto {
  roomId: string;
  position: { line: number; ch: number } | number;
}

export class SyncRoomDto {
  roomId: string;
}