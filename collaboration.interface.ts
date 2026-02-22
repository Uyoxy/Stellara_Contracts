export interface UserPresence {
  clientId: string;
  userId: string;
  username: string;
  color: string;
  cursor?: any;
  connectedAt: Date;
}

export interface RoomState {
  id: string;
  users: Record<string, UserPresence>; // clientId -> Presence
  content: string; // Current document snapshot
  version: number; // Current version
  operations: any[]; // History of operations for conflict resolution
}