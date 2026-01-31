# Kata 3: WebSocket Chat — Approach

## What Interviewers Actually Evaluate

| Signal | What they're looking for |
|--------|--------------------------|
| **Hook extraction** | Can you identify reusable logic and extract it cleanly? |
| **Reconnection logic** | Do you understand exponential backoff? Can you implement it without looking it up? |
| **Message queuing** | Do you think about offline behavior unprompted? |
| **Cleanup discipline** | Do you clear timers on unmount? Do you handle intentional vs unintentional close? |

---

## iPad Sketch

```
useWebSocket state machine:

                      ┌────────────────────────┐
                      ▼                        │
    ┌──────────┐    open    ┌───────────┐      │
    │connecting│───────────▶│ connected │      │
    └──────────┘            └───────────┘      │
         ▲                        │            │
         │                      close          │
         │                        ▼            │
    reconnect              ┌──────────────┐    │
    (if attempt            │ disconnected │────┘
     < maxRetries)         └──────────────┘
         ▲                        │
         └────── delay ◀──────────┘
                (backoff)

Backoff formula: min(baseDelay × 2^attempt, 30000)
  Attempt 0: 1s
  Attempt 1: 2s
  Attempt 2: 4s
  Attempt 3: 8s
  Attempt 4: 16s
  Attempt 5: 30s (capped)

Message queue:
  send() while disconnected → queueRef.push(msg)
  on reconnect → flush queue via ws.send()
```

```
Chat UI:
┌─────────────────────────────┐
│ ● Connected                 │  ← status
├─────────────────────────────┤
│ [alice] Hey                 │
│ [you]   Hi there      ←───────── data-sender="self"
│ [alice] What's up?          │
├─────────────────────────────┤
│ [_______________] [Send]    │
└─────────────────────────────┘
```

---

## Questions to Ask Interviewer

1. "Should queued messages be timestamped when queued or when actually sent?"
   - (Usually: when queued — represents user intent)

2. "On reconnect, should I clear message history or keep it?"
   - (Usually: keep — don't lose user's conversation)

3. "Should the hook reconnect if the URL prop changes?"
   - (Usually: yes — treat URL change as intentional reconnection)

---

## First 2 Minutes: Break It Down (Before Coding)

Model it as a hook with a connection state machine + a send queue:

```
connecting ↔ connected ↔ disconnected
        (reconnect with backoff)
```

Concrete chunks:
1. **Hook API**: `{ status, send, disconnect }` + callbacks (`onMessage`, `onStatusChange`).
2. **Connection lifecycle**: create WS, handle open/message/close, cleanup on unmount.
3. **Stability**: store callbacks in refs so you don’t reconnect on every render.
4. **Send semantics**: send if connected; else queue.
5. **Reconnect**: exponential backoff + max retries; flush queue on reconnect.
6. **Intentional close**: distinguish “user disconnected” vs “network dropped”.

---

## Implementation Order

Each stage shows the complete working hook. New/changed lines are marked with `// ← NEW`.

---

### Stage 1: Basic connection

Minimal working hook. Connects, tracks status, no send yet.

```tsx
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type UseWebSocketOptions = {
  url: string;
  onMessage?: (data: string) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
};

type UseWebSocketReturn = {
  status: ConnectionStatus;
  send: (data: string) => void;
  disconnect: () => void;
};

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, onMessage, onStatusChange } = options;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      onStatusChange?.('connected');
    };

    ws.onmessage = (e) => {
      onMessage?.(e.data);
    };

    ws.onclose = () => {
      wsRef.current = null;
      setStatus('disconnected');
      onStatusChange?.('disconnected');
    };
  }, [url, onMessage, onStatusChange]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const send = useCallback((data: string) => {
    // TODO: implement
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return { status, send, disconnect };
}
```

**Problem with Stage 1**: If parent re-renders with new `onMessage` callback identity, `connect` changes, effect re-runs, and we reconnect unnecessarily.

---

### Stage 2: Stable callback refs

Store callbacks in refs so `connect` only depends on `url`.

```tsx
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type UseWebSocketOptions = {
  url: string;
  onMessage?: (data: string) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
};

type UseWebSocketReturn = {
  status: ConnectionStatus;
  send: (data: string) => void;
  disconnect: () => void;
};

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, onMessage, onStatusChange } = options;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  // ← NEW: Store callbacks in refs
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onStatusChangeRef.current = onStatusChange;
  });

  // ← NEW: Helper that reads from ref
  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const connect = useCallback(() => {
    updateStatus('connecting');                        // ← NEW
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      updateStatus('connected');                       // ← CHANGED
    };

    ws.onmessage = (e) => {
      onMessageRef.current?.(e.data);                  // ← CHANGED
    };

    ws.onclose = () => {
      wsRef.current = null;
      updateStatus('disconnected');                    // ← CHANGED
    };
  }, [url, updateStatus]);  // ← CHANGED: no callback deps

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const send = useCallback((data: string) => {
    // TODO: implement
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return { status, send, disconnect };
}
```

**Problem with Stage 2**: `send()` does nothing, messages while disconnected are lost.

---

### Stage 3: Send with message queue

Queue messages when disconnected, flush on reconnect.

```tsx
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type UseWebSocketOptions = {
  url: string;
  onMessage?: (data: string) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
};

type UseWebSocketReturn = {
  status: ConnectionStatus;
  send: (data: string) => void;
  disconnect: () => void;
};

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, onMessage, onStatusChange } = options;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);              // ← NEW

  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onStatusChangeRef.current = onStatusChange;
  });

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const connect = useCallback(() => {
    updateStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      updateStatus('connected');

      // ← NEW: Flush queued messages
      const queue = queueRef.current;
      queueRef.current = [];
      queue.forEach((msg) => ws.send(msg));
    };

    ws.onmessage = (e) => {
      onMessageRef.current?.(e.data);
    };

    ws.onclose = () => {
      wsRef.current = null;
      updateStatus('disconnected');
    };
  }, [url, updateStatus]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  // ← NEW: Real implementation
  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      queueRef.current.push(data);
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return { status, send, disconnect };
}
```

**Problem with Stage 3**: No automatic reconnection when connection drops.

---

### Stage 4: Reconnection with exponential backoff

Add attempt tracking, backoff delay, and reconnect scheduling.

```tsx
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type UseWebSocketOptions = {
  url: string;
  maxRetries?: number;                                // ← NEW
  baseDelay?: number;                                 // ← NEW
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
    maxRetries = 5,                                   // ← NEW
    baseDelay = 1000,                                 // ← NEW
    onMessage,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);
  const attemptRef = useRef(0);                       // ← NEW
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);  // ← NEW

  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onStatusChangeRef.current = onStatusChange;
  });

  // ← NEW: Store config in refs too
  const maxRetriesRef = useRef(maxRetries);
  const baseDelayRef = useRef(baseDelay);
  useEffect(() => {
    maxRetriesRef.current = maxRetries;
    baseDelayRef.current = baseDelay;
  });

  const updateStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  // ← NEW: Backoff scheduler (declared before connect so connect can reference it)
  const scheduleReconnect = useCallback(() => {
    if (attemptRef.current >= maxRetriesRef.current) return;

    const delay = Math.min(
      baseDelayRef.current * Math.pow(2, attemptRef.current),
      30000
    );
    attemptRef.current++;

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, []);  // connect will be defined, referenced via closure

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;  // ← NEW: guard

    updateStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;                         // ← NEW: reset on success
      updateStatus('connected');

      const queue = queueRef.current;
      queueRef.current = [];
      queue.forEach((msg) => ws.send(msg));
    };

    ws.onmessage = (e) => {
      onMessageRef.current?.(e.data);
    };

    ws.onclose = () => {
      wsRef.current = null;
      updateStatus('disconnected');
      scheduleReconnect();                            // ← NEW
    };

    ws.onerror = () => {
      // onerror always followed by onclose, handle reconnect there
    };
  }, [url, updateStatus, scheduleReconnect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {                // ← NEW: clear timer
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      queueRef.current.push(data);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {                  // ← NEW
      clearTimeout(reconnectTimerRef.current);
    }
    wsRef.current?.close();
  }, []);

  return { status, send, disconnect };
}
```

**Problem with Stage 4**: When user calls `disconnect()`, we still try to reconnect. Need to distinguish intentional close.

---

### Stage 5: Intentional close tracking (Final)

Track whether close was user-initiated. Only reconnect on unexpected disconnection.

```tsx
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type UseWebSocketOptions = {
  url: string;
  maxRetries?: number;
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

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<string[]>([]);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);          // ← NEW
  const isMountedRef = useRef(true);                  // ← NEW

  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onStatusChangeRef.current = onStatusChange;
  });

  const maxRetriesRef = useRef(maxRetries);
  const baseDelayRef = useRef(baseDelay);
  useEffect(() => {
    maxRetriesRef.current = maxRetries;
    baseDelayRef.current = baseDelay;
  });

  // ← NEW: Guard against setState after unmount
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
      if (isMountedRef.current) {                     // ← NEW: guard
        connect();
      }
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    intentionalCloseRef.current = false;              // ← NEW: reset flag
    updateStatus('connecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      updateStatus('connected');

      const queue = queueRef.current;
      queueRef.current = [];
      queue.forEach((msg) => ws.send(msg));
    };

    ws.onmessage = (e) => {
      onMessageRef.current?.(e.data);
    };

    ws.onclose = () => {
      wsRef.current = null;
      updateStatus('disconnected');

      // ← NEW: Only reconnect if not intentional
      if (!intentionalCloseRef.current && isMountedRef.current) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {};
  }, [url, updateStatus, scheduleReconnect]);

  useEffect(() => {
    isMountedRef.current = true;                      // ← NEW
    connect();

    return () => {
      isMountedRef.current = false;                   // ← NEW
      intentionalCloseRef.current = true;             // ← NEW: prevent reconnect on unmount
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    } else {
      queueRef.current.push(data);
    }
  }, []);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;               // ← NEW: mark as intentional
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    wsRef.current?.close();
  }, []);

  return { status, send, disconnect };
}
```

**This is the complete hook.** Each stage addressed a specific gap:
1. Basic connection → works but unstable callbacks
2. Callback refs → stable but no send
3. Send + queue → works but no reconnect
4. Backoff reconnect → works but reconnects even when intentional
5. Intentional close → production-ready

---

## Red Flags That Sink Candidates

| Mistake | Why it's a red flag |
|---------|---------------------|
| Reconnecting after intentional close | Shows you don't track close intent. Zombie connections. |
| Not clearing reconnect timer on unmount | Memory leak, setState after unmount. |
| Storing WebSocket in state | Causes unnecessary re-renders. WebSocket is mutable, not state. |
| Reconnecting in onerror instead of onclose | onerror is always followed by onclose — you'll double-reconnect. |
| Forgetting to reset attempt counter | Exponential backoff never resets, reconnect delay stays at max. |

---

## Chat Component: Auto-scroll Logic

Only scroll to bottom if user was already at bottom. Otherwise they're reading history.

```tsx
const listRef = useRef<HTMLUListElement>(null);
const wasAtBottomRef = useRef(true);

// Check before updating messages:
const checkScroll = () => {
  const el = listRef.current;
  if (!el) return;
  const threshold = 10;  // px tolerance
  wasAtBottomRef.current =
    el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
};

// Scroll after messages update:
useLayoutEffect(() => {
  if (wasAtBottomRef.current && listRef.current) {
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }
}, [messages]);
```

---

## Production Concerns (Follow-up Discussion)

1. **Heartbeat/ping**: Detect dead connections before server timeout
2. **Message acknowledgment**: Track sent vs delivered vs read
3. **Optimistic updates**: Show sent message immediately, mark as pending
4. **Reconnection backoff jitter**: Add randomness to prevent thundering herd
5. **Message ordering**: Handle out-of-order delivery with sequence numbers
