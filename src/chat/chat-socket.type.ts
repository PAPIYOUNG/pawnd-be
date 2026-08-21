import { Server, Socket } from 'socket.io';
import type { ChatService } from './chat.service';

export type ChatWebSocketError = {
  code: string;
  message: string;
};

export type ChatWebSocketAcknowledgement<T> =
  { success: true; data: T } | { success: false; error: ChatWebSocketError };

export type ChatReadUpdatedPayload = {
  roomId: string;
  userId: string;
  lastReadAt: string;
};

export type ChatMessagePayload = Awaited<
  ReturnType<ChatService['persistMessage']>
>['message'];

type ChatClientToServerEvents = Record<never, never>;

interface ChatServerToClientEvents {
  new_message: (message: ChatMessagePayload) => void;
  read_updated: (payload: ChatReadUpdatedPayload) => void;
}

type ChatInterServerEvents = Record<never, never>;

export interface ChatSocketData {
  userId: string;
}

export type AuthenticatedChatSocket = Socket<
  ChatClientToServerEvents,
  ChatServerToClientEvents,
  ChatInterServerEvents,
  ChatSocketData
>;

export type ChatSocketServer = Server<
  ChatClientToServerEvents,
  ChatServerToClientEvents,
  ChatInterServerEvents,
  ChatSocketData
>;
