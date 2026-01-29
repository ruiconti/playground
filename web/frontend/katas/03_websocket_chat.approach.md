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

## Implementation Order

### 1. Basic connection (no reconnection yet)

```tsx
function useWebSocket(options: UseWebSocketOptions) {
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

    ws.onmessage = (e) => onMessage?.(e.data);

    ws.onclose = () => {
      setStatus('disconnected');
      onStatusChange?.('disconnected');
    };
  }, [url, onMessage, onStatusChange]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { status, send: () => {}, disconnect: () => {} };
}
```

### 2. Add send() with queueing

```tsx
const queueRef = useRef<string[]>([]);

const send = useCallback((data: string) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(data);
  } else {
    queueRef.current.push(data);  // queue for later
  }
}, []);

// In ws.onopen, flush the queue:
ws.onopen = () => {
  // ...
  const queue = queueRef.current;
  queueRef.current = [];
  queue.forEach(msg => ws.send(msg));
};
```

### 3. Add intentional disconnect

```tsx
const intentionalCloseRef = useRef(false);

const disconnect = useCallback(() => {
  intentionalCloseRef.current = true;
  wsRef.current?.close();
}, []);

// In ws.onclose, check before reconnecting:
ws.onclose = () => {
  // ...
  if (!intentionalCloseRef.current) {
    scheduleReconnect();
  }
};
```

### 4. Add reconnection with backoff

```tsx
const attemptRef = useRef(0);
const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const scheduleReconnect = useCallback(() => {
  if (attemptRef.current >= maxRetries) return;

  const delay = Math.min(baseDelay * Math.pow(2, attemptRef.current), 30000);
  attemptRef.current++;

  reconnectTimerRef.current = setTimeout(() => {
    connect();
  }, delay);
}, [maxRetries, baseDelay, connect]);

// Reset attempt counter on successful connect:
ws.onopen = () => {
  attemptRef.current = 0;
  // ...
};
```

### 5. Cleanup

```tsx
useEffect(() => {
  connect();
  return () => {
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close();
  };
}, [connect]);
```

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
