import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
} from "react";

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
  const {
    url,
    maxRetries = 5,
    baseDelay = 1000,
    onMessage,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Store callbacks in refs to avoid effect re-runs when parent re-renders
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onStatusChangeRef.current = onStatusChange;
  });

  // Store config in refs too - they shouldn't trigger reconnect
  const maxRetriesRef = useRef(maxRetries);
  const baseDelayRef = useRef(baseDelay);
  useEffect(() => {
    maxRetriesRef.current = maxRetries;
    baseDelayRef.current = baseDelay;
  });

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    if (!isMountedRef.current) return;
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (attemptRef.current >= maxRetriesRef.current) return;

    const delay = Math.min(
      baseDelayRef.current * Math.pow(2, attemptRef.current),
      30000
    );
    attemptRef.current++;

    reconnectTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    intentionalCloseRef.current = false;
    updateStatus("connecting");

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      updateStatus("connected");

      // Flush queued messages
      const queue = queueRef.current;
      queueRef.current = [];
      queue.forEach((msg) => ws.send(msg));
    };

    ws.onmessage = (e) => {
      onMessageRef.current?.(e.data);
    };

    ws.onclose = () => {
      wsRef.current = null;
      updateStatus("disconnected");

      if (!intentionalCloseRef.current && isMountedRef.current) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose, so we handle reconnect there
    };
  }, [url, updateStatus, scheduleReconnect]); // Only reconnect when URL changes

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      queueRef.current.push(data);
    }
  }, []);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    wsRef.current?.close();
  }, []);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, send, disconnect };
}

// ---

type Message = {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
};

type ChatProps = {
  url: string;
  username: string;
};

export function Chat({ url, username }: ChatProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const listRef = useRef<HTMLUListElement>(null);
  const wasAtBottomRef = useRef(true);

  const handleMessage = useCallback((data: string) => {
    try {
      const message: Message = JSON.parse(data);
      setMessages((prev) => [...prev, message]);
    } catch {
      // Ignore invalid JSON
    }
  }, []);

  const { status, send } = useWebSocket({
    url,
    onMessage: handleMessage,
  });

  // Check scroll position before messages update
  const checkScrollPosition = () => {
    const el = listRef.current;
    if (el) {
      const threshold = 10;
      wasAtBottomRef.current =
        el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    }
  };

  // Auto-scroll after messages update
  useLayoutEffect(() => {
    if (wasAtBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;

    checkScrollPosition();

    const message: Message = {
      id: crypto.randomUUID(),
      text,
      sender: username,
      timestamp: Date.now(),
    };

    send(JSON.stringify(message));
    setMessages((prev) => [...prev, message]);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const statusText =
    status === "connected"
      ? "Connected"
      : status === "connecting"
        ? "Connecting..."
        : "Disconnected";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "400px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Status indicator */}
      <div
        data-testid="status"
        style={{
          padding: "8px 12px",
          backgroundColor: "#f5f5f5",
          borderBottom: "1px solid #ccc",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor:
              status === "connected"
                ? "#28a745"
                : status === "connecting"
                  ? "#ffc107"
                  : "#dc3545",
          }}
        />
        {statusText}
      </div>

      {/* Message list */}
      <ul
        ref={listRef}
        data-testid="message-list"
        onScroll={checkScrollPosition}
        style={{
          flex: 1,
          overflowY: "auto",
          margin: 0,
          padding: "12px",
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {messages.map((message) => {
          const isSelf = message.sender === username;
          return (
            <li
              key={message.id}
              data-sender={isSelf ? "self" : "other"}
              style={{
                alignSelf: isSelf ? "flex-end" : "flex-start",
                maxWidth: "70%",
                padding: "8px 12px",
                borderRadius: "12px",
                backgroundColor: isSelf ? "#007bff" : "#e9ecef",
                color: isSelf ? "#fff" : "#000",
              }}
            >
              {!isSelf && (
                <div
                  style={{
                    fontSize: "12px",
                    opacity: 0.7,
                    marginBottom: "4px",
                  }}
                >
                  {message.sender}
                </div>
              )}
              {message.text}
            </li>
          );
        })}
      </ul>

      {/* Input area */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "12px",
          borderTop: "1px solid #ccc",
        }}
      >
        <input
          data-testid="message-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <button
          data-testid="send-btn"
          onClick={handleSend}
          disabled={!inputValue.trim()}
          style={{
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: inputValue.trim() ? "pointer" : "not-allowed",
            opacity: inputValue.trim() ? 1 : 0.6,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
