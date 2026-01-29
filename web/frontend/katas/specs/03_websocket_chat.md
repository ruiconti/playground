# Kata 3 — WebSocket Chat

## Context

You're building a real-time messaging component for a collaborative application. The component connects to a WebSocket server, displays incoming messages, allows sending messages, and handles connection lifecycle (disconnects, reconnection).

---

## Goal

Implement a `Chat` React component and a `useWebSocket` hook that:

- Connects to a WebSocket endpoint and renders messages in real time
- Sends messages through the WebSocket
- Handles connection status (connecting, connected, disconnected)
- Implements automatic reconnection with exponential backoff
- Queues messages sent while disconnected

---

## API

```tsx
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

export function Chat(props: ChatProps): JSX.Element {
  throw new Error("TODO");
}
```

---

## Behavior

### `useWebSocket` hook

**Connection:**
- Create a `WebSocket` on mount (or when `url` changes).
- Set status to `"connecting"` immediately, `"connected"` on `open`, `"disconnected"` on `close` or `error`.
- Call `onStatusChange` whenever status changes.

**Receiving:**
- On each `message` event, call `onMessage(event.data)`.

**Sending:**
- If connected, send immediately via `ws.send(data)`.
- If not connected, queue the message. Flush the queue when connection is re-established.

**Reconnection:**
- On unexpected close (not triggered by `disconnect()`), attempt to reconnect.
- Use exponential backoff: `delay = baseDelay * 2^attempt` capped at 30 seconds.
- Stop after `maxRetries` attempts. Status stays `"disconnected"`.

**Disconnect:**
- Calling `disconnect()` closes the WebSocket cleanly and does not trigger reconnection.

**Cleanup:**
- On unmount, close the WebSocket and clear all timers. No reconnection attempts after unmount.

### `Chat` component

**Messages:**
- Parse incoming WebSocket messages as JSON: `{ id: string, text: string, sender: string, timestamp: number }`.
- Display messages in a scrollable list (`data-testid="message-list"`).
- Each message shows sender and text.
- Self-messages (where `sender === username`) are visually distinguished (add `data-sender="self"` attribute).

**Sending:**
- Input field (`data-testid="message-input"`) and send button (`data-testid="send-btn"`).
- On send, serialize as JSON: `{ id: crypto.randomUUID(), text, sender: username, timestamp: Date.now() }`.
- Clear input after sending.
- Enter key in input also sends.

**Status indicator:**
- Show connection status (`data-testid="status"`).
- Text content: `"Connected"`, `"Connecting..."`, or `"Disconnected"` matching the status.

**Auto-scroll:**
- Scroll to bottom when new messages arrive (only if user was already at the bottom).

---

## Test utilities

Use a mock WebSocket for testing:

```ts
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.(); }

  // Test helpers
  simulateOpen() { this.readyState = 1; this.onopen?.(); }
  simulateMessage(data: string) { this.onmessage?.({ data }); }
  simulateClose() { this.readyState = 3; this.onclose?.(); }
  simulateError() { this.onerror?.(new Event("error")); }
}
```

---

## Tests you should write

### useWebSocket

- Status transitions: connecting → connected on open
- Messages received via onMessage callback
- send() delivers data when connected
- send() queues data when disconnected, flushes on reconnect
- Reconnects with exponential backoff on unexpected close
- disconnect() closes cleanly without reconnection
- Stops reconnecting after maxRetries
- Cleanup on unmount cancels timers and closes socket

### Chat component

- Renders incoming messages
- Self-messages have correct data-sender attribute
- Send button dispatches message as JSON
- Enter key sends message
- Input clears after send
- Status indicator reflects connection state

---

## Follow-up ladder (do not implement unless asked)

1. Add typing indicators ("user is typing..." based on input focus + debounce).
2. Add message delivery receipts (sent → delivered → read).
3. Add presence indicators showing which users are online.
