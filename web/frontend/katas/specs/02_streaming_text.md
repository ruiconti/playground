# Kata 2 — Streaming Text Renderer

## Context

You're building the chat interface for an AI assistant. The backend streams tokens via a `ReadableStream` (like ChatGPT or Cursor's chat). Your component must render tokens as they arrive, support cancellation, and handle stream lifecycle correctly.

---

## Goal

Implement a `StreamingText` React component that:

- Consumes a `ReadableStream<string>` and renders tokens incrementally
- Provides a stop button to cancel the stream mid-generation
- Handles stream completion, cancellation, and errors
- Exposes an imperative `start` method to begin streaming

---

## API

```tsx
type StreamingTextProps = {
  /** Factory that returns a new ReadableStream of string tokens. */
  createStream: () => ReadableStream<string>;
  /** Called when the stream completes or is cancelled. */
  onDone?: (result: { text: string; cancelled: boolean }) => void;
};

export type StreamingTextHandle = {
  /** Start consuming the stream. No-op if already streaming. */
  start: () => void;
};

export const StreamingText = React.forwardRef<StreamingTextHandle, StreamingTextProps>(
  function StreamingText(props, ref) {
    throw new Error("TODO");
  }
);
```

---

## Behavior

### Streaming

- Call `createStream()` when `start()` is invoked via the ref.
- Read from the stream using `getReader()`. Each chunk is a string token (a word or partial word).
- Append each token to the displayed text as it arrives.
- When the stream closes naturally, call `onDone({ text, cancelled: false })`.

### Stop / Cancel

- While streaming, render a button with `data-testid="stop-btn"`.
- Clicking stop calls `reader.cancel()`, stops rendering new tokens, and calls `onDone({ text, cancelled: true })` with whatever text was accumulated so far.
- The stop button should not render when idle.

### State indicators

- While streaming, show a cursor/blinking indicator (element with `data-testid="cursor"`).
- When idle (before start or after done), no cursor.

### Error handling

- If the stream errors, display "Stream error" (element with `data-testid="error"`).
- Call `onDone({ text, cancelled: false })` with whatever text was accumulated before the error.

### Cleanup

- If the component unmounts while streaming, cancel the reader and do not call `onDone` or update state.

---

## Test utilities

Use this helper to create mock streams in tests:

```ts
function createMockStream(tokens: string[], delayMs = 0): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      for (const token of tokens) {
        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
        controller.enqueue(token);
      }
      controller.close();
    },
  });
}

function createErrorStream(tokens: string[], errorAfter: number): ReadableStream<string> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < errorAfter) {
        controller.enqueue(tokens[i++]);
      } else {
        controller.error(new Error("stream failed"));
      }
    },
  });
}
```

---

## Tests you should write

### Core streaming

- Tokens render incrementally as the stream produces them
- `onDone` is called with full text and `cancelled: false` when stream closes
- Text accumulates correctly across multiple tokens

### Cancellation

- Clicking stop button cancels the stream
- `onDone` is called with partial text and `cancelled: true`
- Stop button disappears after cancel

### Lifecycle

- Stop button only renders while streaming
- Cursor indicator only shows while streaming
- Calling `start()` while already streaming is a no-op

### Error handling

- Stream error shows error state
- Accumulated text before error is preserved

### Cleanup

- Unmounting during stream cancels the reader without state updates

---

## Follow-up ladder (do not implement unless asked)

1. Add markdown rendering (bold, code blocks, links) as tokens arrive.
2. Add a "copy to clipboard" button that appears after stream completes.
3. Support multiple messages in a conversation layout (array of streams).
