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

### 1. Skeleton with forwardRef

```tsx
export const StreamingText = React.forwardRef<
  StreamingTextHandle,
  StreamingTextProps
>(function StreamingText({ createStream, onDone }, ref) {
  // ...
});
```

### 2. State and refs

```tsx
const [text, setText] = useState('');
const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');

const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
const isMountedRef = useRef(true);
const cancelledRef = useRef(false);
```

### 3. Mount tracking

```tsx
useEffect(() => {
  isMountedRef.current = true;
  return () => {
    isMountedRef.current = false;
    readerRef.current?.cancel();  // cleanup
  };
}, []);
```

### 4. Expose handle

```tsx
useImperativeHandle(ref, () => ({ start }), [start]);
```

### 5. Stop handler

```tsx
const handleStop = useCallback(async () => {
  if (!readerRef.current) return;

  cancelledRef.current = true;  // MUST set before cancel()
  try {
    await readerRef.current.cancel();
  } catch {
    // Ignore — cancellation errors are expected
  }
}, []);
```

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
