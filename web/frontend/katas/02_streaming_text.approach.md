# Kata 2: Streaming Text — Approach

## What Interviewers Actually Evaluate

| Signal | What they're looking for |
|--------|--------------------------|
| **ReadableStream API** | Can you use `getReader()` and the async iteration pattern without docs? |
| **Imperative handles** | Do you know when `useImperativeHandle` is appropriate? Can you explain why it exists? |
| **Cleanup discipline** | Do you instinctively think about unmount during async operations? |
| **Cancellation semantics** | Do you understand that `reader.cancel()` can resolve (done=true) OR throw, depending on the stream implementation? |

---

## iPad Sketch

```
Lifecycle:
  [idle] → start() → [streaming] → [done]
                          ↓
                     stop clicked
                          ↓
                    reader.cancel()
                          ↓
              { done: true } OR throw
                          ↓
                   check cancelledRef
                          ↓
                 [done, cancelled: true]

UI:
┌─────────────────────────────┐
│ "Hello world, I am..."  █  │  ← cursor = streaming
│                             │
│          [Stop]             │  ← only while streaming
└─────────────────────────────┘

Refs (not state):
  readerRef: ReadableStreamDefaultReader | null
  isMountedRef: boolean
  cancelledRef: boolean
```

---

## Questions to Ask Interviewer

1. "Should `start()` reset the text if called after completion, or append?"
   - (Usually: reset — each stream is a new generation)

2. "On error, should I preserve partial text or clear it?"
   - (Usually: preserve — the user wants to see what was generated)

3. "Does the cursor need to be accessible, or is it purely decorative?"
   - (Usually: decorative, use `aria-hidden`)

---

## First 2 Minutes: Break It Down (Before Coding)

Think of it as a controlled loop with cancellation + cleanup:

```
idle -- start() --> streaming -- done/error --> idle/done
             \-- stop() cancels reader --/
```

Concrete chunks:
1. **API**: `createStream()` input, `onDone()` output, imperative `start()` handle.
2. **State machine**: `status` + `text`.
3. **Core loop**: `reader.read()` until `done`, accumulate tokens.
4. **Cancellation**: `stop()` sets a flag + `reader.cancel()`.
5. **Unmount safety**: cancel reader + avoid state updates after unmount.
6. **Correct done semantics**: treat “done after cancel” differently from “done naturally”.

---

## Critical Implementation Detail: Cancellation

**This is where candidates fail.** When you call `reader.cancel()`:

1. The next `reader.read()` might return `{ done: true, value: undefined }`
2. OR it might throw an error

Both behaviors are valid per the spec. Your code must handle both:

```tsx
const start = useCallback(async () => {
  if (readerRef.current) return; // already streaming

  cancelledRef.current = false;
  setText('');
  setStatus('streaming');

  const reader = createStream().getReader();
  readerRef.current = reader;

  let accumulated = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      accumulated += value;
      if (isMountedRef.current) setText(accumulated);
    }

    // SUCCESS PATH — but might be due to cancellation!
    if (isMountedRef.current) {
      const wasCancelled = cancelledRef.current;  // CHECK THIS
      setStatus('done');
      onDone?.({ text: accumulated, cancelled: wasCancelled });
    }
  } catch {
    // ERROR PATH — might be cancellation or real error
    if (isMountedRef.current) {
      if (cancelledRef.current) {
        setStatus('done');
        onDone?.({ text: accumulated, cancelled: true });
      } else {
        setStatus('error');
        onDone?.({ text: accumulated, cancelled: false });
      }
    }
  } finally {
    readerRef.current = null;
  }
}, [createStream, onDone]);
```

---

## Implementation Order

Each stage shows complete working code. New/changed lines marked with `// ← NEW`.

---

### Stage 1: Basic forwardRef skeleton

Just the shell with types and forwardRef structure.

```tsx
import React, {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
} from 'react';

type StreamingTextProps = {
  createStream: () => ReadableStream<string>;
  onDone?: (result: { text: string; cancelled: boolean }) => void;
};

export type StreamingTextHandle = {
  start: () => void;
};

type Status = 'idle' | 'streaming' | 'done' | 'error';

export const StreamingText = React.forwardRef<
  StreamingTextHandle,
  StreamingTextProps
>(function StreamingText({ createStream, onDone }, ref) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const start = useCallback(async () => {
    setText('');
    setStatus('streaming');

    const stream = createStream();
    const reader = stream.getReader();
    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += value;
        setText(accumulated);
      }

      setStatus('done');
      onDone?.({ text: accumulated, cancelled: false });
    } catch {
      setStatus('error');
    }
  }, [createStream, onDone]);

  useImperativeHandle(ref, () => ({ start }), [start]);

  return (
    <div>
      <div style={{ minHeight: '100px', whiteSpace: 'pre-wrap' }}>
        {text}
        {status === 'streaming' && <span>█</span>}
      </div>
      {status === 'error' && <div style={{ color: 'red' }}>Stream error</div>}
    </div>
  );
});
```

**Problem with Stage 1**: No stop button. No unmount cleanup. `start` recreates when parent re-renders because `createStream`/`onDone` are in deps.

---

### Stage 2: Add stop button and reader ref

Track reader so we can cancel it.

```tsx
import React, {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
} from 'react';

type StreamingTextProps = {
  createStream: () => ReadableStream<string>;
  onDone?: (result: { text: string; cancelled: boolean }) => void;
};

export type StreamingTextHandle = {
  start: () => void;
};

type Status = 'idle' | 'streaming' | 'done' | 'error';

export const StreamingText = React.forwardRef<
  StreamingTextHandle,
  StreamingTextProps
>(function StreamingText({ createStream, onDone }, ref) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);  // ← NEW

  const start = useCallback(async () => {
    if (readerRef.current) return;                      // ← NEW: Guard against double-start

    setText('');
    setStatus('streaming');

    const stream = createStream();
    const reader = stream.getReader();
    readerRef.current = reader;                         // ← NEW

    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += value;
        setText(accumulated);
      }

      setStatus('done');
      onDone?.({ text: accumulated, cancelled: false });
    } catch {
      setStatus('error');
    } finally {
      readerRef.current = null;                         // ← NEW
    }
  }, [createStream, onDone]);

  // ← NEW: Stop handler
  const handleStop = useCallback(async () => {
    if (!readerRef.current) return;
    try {
      await readerRef.current.cancel();
    } catch {
      // Ignore cancel errors
    }
  }, []);

  useImperativeHandle(ref, () => ({ start }), [start]);

  const isStreaming = status === 'streaming';

  return (
    <div>
      <div style={{ minHeight: '100px', whiteSpace: 'pre-wrap' }}>
        {text}
        {isStreaming && <span>█</span>}
      </div>
      {status === 'error' && <div style={{ color: 'red' }}>Stream error</div>}
      {/* ← NEW: Stop button */}
      {isStreaming && (
        <button onClick={handleStop}>Stop</button>
      )}
    </div>
  );
});
```

**Problem with Stage 2**: When stop is clicked, `onDone` is called with `cancelled: false` (error path doesn't know it was intentional). Also, `start` still recreates on parent re-render.

---

### Stage 3: Track cancellation intent

Distinguish user-initiated stop from unexpected errors.

```tsx
import React, {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
} from 'react';

type StreamingTextProps = {
  createStream: () => ReadableStream<string>;
  onDone?: (result: { text: string; cancelled: boolean }) => void;
};

export type StreamingTextHandle = {
  start: () => void;
};

type Status = 'idle' | 'streaming' | 'done' | 'error';

export const StreamingText = React.forwardRef<
  StreamingTextHandle,
  StreamingTextProps
>(function StreamingText({ createStream, onDone }, ref) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const cancelledRef = useRef(false);                   // ← NEW

  const start = useCallback(async () => {
    if (readerRef.current) return;

    cancelledRef.current = false;                       // ← NEW: Reset on new stream
    setText('');
    setStatus('streaming');

    const stream = createStream();
    const reader = stream.getReader();
    readerRef.current = reader;

    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += value;
        setText(accumulated);
      }

      // ← NEW: Success path might be due to cancellation!
      const wasCancelled = cancelledRef.current;
      setStatus('done');
      onDone?.({ text: accumulated, cancelled: wasCancelled });
    } catch {
      // ← NEW: Check if error was due to cancellation
      if (cancelledRef.current) {
        setStatus('done');
        onDone?.({ text: accumulated, cancelled: true });
      } else {
        setStatus('error');
        onDone?.({ text: accumulated, cancelled: false });
      }
    } finally {
      readerRef.current = null;
    }
  }, [createStream, onDone]);

  const handleStop = useCallback(async () => {
    if (!readerRef.current) return;

    cancelledRef.current = true;                        // ← NEW: Mark before cancel
    try {
      await readerRef.current.cancel();
    } catch {
      // Ignore cancel errors
    }
  }, []);

  useImperativeHandle(ref, () => ({ start }), [start]);

  const isStreaming = status === 'streaming';

  return (
    <div>
      <div style={{ minHeight: '100px', whiteSpace: 'pre-wrap' }}>
        {text}
        {isStreaming && <span>█</span>}
      </div>
      {status === 'error' && <div style={{ color: 'red' }}>Stream error</div>}
      {isStreaming && (
        <button onClick={handleStop}>Stop</button>
      )}
    </div>
  );
});
```

**Problem with Stage 3**: Component can unmount while streaming. setState on unmounted component = memory leak + React warning. Also, `start` still recreates when parent passes new callbacks.

---

### Stage 4: Mount guard + stable callback refs (Final)

Prevent setState after unmount. Store callbacks in refs for stable `start` identity.

```tsx
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';

type StreamingTextProps = {
  createStream: () => ReadableStream<string>;
  onDone?: (result: { text: string; cancelled: boolean }) => void;
};

export type StreamingTextHandle = {
  start: () => void;
};

type Status = 'idle' | 'streaming' | 'done' | 'error';

export const StreamingText = React.forwardRef<
  StreamingTextHandle,
  StreamingTextProps
>(function StreamingText({ createStream, onDone }, ref) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const cancelledRef = useRef(false);
  const isMountedRef = useRef(true);                    // ← NEW

  // ← NEW: Store callbacks in refs for stable start()
  const createStreamRef = useRef(createStream);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    createStreamRef.current = createStream;
    onDoneRef.current = onDone;
  });

  // ← NEW: Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      readerRef.current?.cancel();                      // Cleanup on unmount
    };
  }, []);

  const start = useCallback(async () => {
    if (readerRef.current) return;

    cancelledRef.current = false;
    setText('');
    setStatus('streaming');

    const stream = createStreamRef.current();           // ← CHANGED: Read from ref
    const reader = stream.getReader();
    readerRef.current = reader;

    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += value;
        if (isMountedRef.current) {                     // ← NEW: Guard setState
          setText(accumulated);
        }
      }

      if (isMountedRef.current) {                       // ← NEW: Guard setState
        const wasCancelled = cancelledRef.current;
        setStatus('done');
        onDoneRef.current?.({ text: accumulated, cancelled: wasCancelled });
      }
    } catch {
      if (isMountedRef.current) {                       // ← NEW: Guard setState
        if (cancelledRef.current) {
          setStatus('done');
          onDoneRef.current?.({ text: accumulated, cancelled: true });
        } else {
          setStatus('error');
          onDoneRef.current?.({ text: accumulated, cancelled: false });
        }
      }
    } finally {
      readerRef.current = null;
    }
  }, []);  // ← CHANGED: No deps — callbacks are in refs

  const handleStop = useCallback(async () => {
    if (!readerRef.current) return;

    cancelledRef.current = true;
    try {
      await readerRef.current.cancel();
    } catch {
      // Ignore cancel errors
    }
  }, []);

  useImperativeHandle(ref, () => ({ start }), [start]);

  const isStreaming = status === 'streaming';

  return (
    <div>
      <div style={{ minHeight: '100px', whiteSpace: 'pre-wrap' }}>
        {text}
        {isStreaming && <span>█</span>}
      </div>
      {status === 'error' && <div style={{ color: 'red' }}>Stream error</div>}
      {isStreaming && (
        <button onClick={handleStop}>Stop</button>
      )}
    </div>
  );
});
```

**This is the complete component.** Each stage addressed a specific gap:
1. Basic skeleton → works but no stop, no cleanup
2. Stop button → works but doesn't report cancellation correctly
3. Cancellation tracking → correct but leaks on unmount, recreates start()
4. Mount guard + refs → production-ready

---

## Red Flags That Sink Candidates

| Mistake | Why it's a red flag |
|---------|---------------------|
| Storing reader in state | Causes re-render on every token. Shows misunderstanding of when to use state vs ref. |
| Not checking `isMountedRef` before setState | React warning, memory leak. Basic cleanup failure. |
| Only checking `cancelledRef` in catch block | Misses the case where cancel() causes done=true instead of throwing. |
| Forgetting to reset `cancelledRef` on new start | Previous cancellation affects new streams. |
| Calling `onDone` after unmount | Leaks into parent component, potential crashes. |

---

## Why useImperativeHandle?

The interviewer might ask why we use this pattern instead of a prop-based `isStreaming` boolean.

**Answer:** The parent needs to trigger streaming at a specific moment (e.g., after form submission). With a boolean prop, you'd need:
1. Parent sets `isStreaming={true}`
2. Child sees the change in useEffect
3. Child starts streaming
4. Child somehow signals back "I've started"

This creates awkward synchronization. The imperative handle lets the parent say "start now" and know it happened immediately.

---

## Production Concerns (Follow-up Discussion)

1. **Backpressure**: What if tokens arrive faster than React can render? Consider batching updates.
2. **Markdown rendering**: Parse markdown incrementally as tokens arrive (tricky with partial syntax).
3. **Retry on error**: Should we auto-retry with exponential backoff?
4. **Multiple streams**: Conversation UI needs to manage multiple StreamingText instances.
