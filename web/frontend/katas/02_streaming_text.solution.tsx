import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useImperativeHandle,
} from "react";

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

type Status = "idle" | "streaming" | "done" | "error";

export const StreamingText = React.forwardRef<
  StreamingTextHandle,
  StreamingTextProps
>(function StreamingText({ createStream, onDone }, ref) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const isMountedRef = useRef(true);
  const cancelledRef = useRef(false);

  // Store callbacks in refs to avoid recreating start() when parent re-renders
  const createStreamRef = useRef(createStream);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    createStreamRef.current = createStream;
    onDoneRef.current = onDone;
  });

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cancel reader on unmount
      readerRef.current?.cancel();
    };
  }, []);

  const start = useCallback(async () => {
    // No-op if already streaming
    if (readerRef.current) return;

    // Reset state
    cancelledRef.current = false;
    setText("");
    setStatus("streaming");

    const stream = createStreamRef.current();
    const reader = stream.getReader();
    readerRef.current = reader;

    let accumulated = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += value;
        if (isMountedRef.current) {
          setText(accumulated);
        }
      }

      // Stream completed - check if it was due to cancellation
      // (reader.cancel() can cause done=true instead of throwing)
      if (isMountedRef.current) {
        const wasCancelled = cancelledRef.current;
        setStatus("done");
        onDoneRef.current?.({ text: accumulated, cancelled: wasCancelled });
      }
    } catch {
      // Stream cancelled or errored
      if (isMountedRef.current) {
        if (cancelledRef.current) {
          setStatus("done");
          onDoneRef.current?.({ text: accumulated, cancelled: true });
        } else {
          setStatus("error");
          onDoneRef.current?.({ text: accumulated, cancelled: false });
        }
      }
    } finally {
      readerRef.current = null;
    }
  }, []); // No deps - callbacks are in refs

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

  const isStreaming = status === "streaming";

  return (
    <div style={{ fontFamily: "system-ui", lineHeight: 1.5 }}>
      <div style={{ minHeight: "100px", whiteSpace: "pre-wrap" }}>
        {text}
        {isStreaming && (
          <span
            data-testid="cursor"
            style={{
              display: "inline-block",
              width: "2px",
              height: "1em",
              backgroundColor: "#000",
              marginLeft: "2px",
              animation: "blink 1s step-end infinite",
            }}
          />
        )}
      </div>

      {status === "error" && (
        <div
          data-testid="error"
          style={{ color: "#c00", marginTop: "8px" }}
        >
          Stream error
        </div>
      )}

      {isStreaming && (
        <button
          data-testid="stop-btn"
          onClick={handleStop}
          style={{
            marginTop: "12px",
            padding: "8px 16px",
            backgroundColor: "#dc3545",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Stop
        </button>
      )}

      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
});
