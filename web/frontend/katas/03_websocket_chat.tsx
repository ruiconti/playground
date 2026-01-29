import React from "react";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

type UseWebSocketOptions = {
  url: string;
  /** Max reconnection attempts before giving up. Default: 5 */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms. Default: 1000 */
  baseDelay?: number;
  onMessage?: (data: string) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
};

type UseWebSocketReturn = {
  status: ConnectionStatus;
  send: (data: string) => void;
  disconnect: () => void;
};

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  throw new Error("TODO");
}

type Message = {
  id: string;
  text: string;
  sender: string;  // The sender's username
  timestamp: number;
};

type ChatProps = {
  url: string;
  username: string;
};

export function Chat(props: ChatProps): React.ReactElement {
  throw new Error("TODO");
}
