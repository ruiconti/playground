import React, { useImperativeHandle, useRef, useState } from "react";

type StreamingTextProps = {
  /** Factory that returns a new ReadableStream of string tokens. */
  createStream: () => ReadableStream<string>;
  /** Called when the stream completes or is cancelled. */
  onDone?: (result: { text: string; cancelled: boolean }) => void;
  onStart?: () => void;
  onStop?: () => void;
  onError?: (error: Error) => void;
};

export type StreamingTextHandle = {
  /** Start consuming the stream. No-op if already streaming. */
  start: () => void;
  stop: () => void;
};

type StreamingTextState = 'idle' | 'streaming' | 'done' | 'error'
export const StreamingText = React.forwardRef<
  StreamingTextHandle,
  StreamingTextProps
>(function StreamingText(props, ref) {
  const [text, setText] = useState('');
  const { createStream, onDone, onStart, onStop, onError } = props;
  const [state, setState] = useState<StreamingTextState>('idle');

  const isStreaming = state === 'streaming';
  const isDone = state === 'done';

  // eval if useCallback or useRef for consistency across renders
  const rs = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const userCancelledRef = useRef(false);
  useImperativeHandle(ref, () => ({
    stop: async () => {
      if (!rs.current) {
        console.error('No reader to stop');
        return;
      }
      if (!isStreaming) {
        console.error('Not streaming, nothing to stop')
        return;
      }

      onStop?.();
      await rs.current.cancel(); // this can also make the reader throw!
    },
    start: async () => {
      if (rs.current) return;
      setState('streaming')
      const stream = createStream();
      rs.current = stream.getReader();
      let acc = '';
      try {
        while (true) {
          const { done, value } = await rs.current.read();
          if (done) break;
          acc += value;
          setText(acc);
        }

        setState('done')
        if (userCancelledRef.current) {
          onDone?.({ text: acc, cancelled: true });
          userCancelledRef.current = false; // reset for next time
        } else {
          onDone?.({ text: acc, cancelled: false });
        }
      } catch (error) {
        if (userCancelledRef.current) {
          setState('done')
          console.log('User cancelled');
          userCancelledRef.current = false; // reset for next time
          onDone?.({ text: acc, cancelled: true });
        } else {
          setState('error')
          console.error(error);
          onError?.(error as Error);
        }
      } finally {
        rs.current = null;
      }
    }
  }), [createStream, onDone, isStreaming, onStop, onError])

  return (
    <div>
      {(isStreaming || isDone) && <div className="inline-block whitespace-pre-wrap"><span>{text}{isStreaming && <span data-testid="cursor">|</span>}</span></div>}
    </div>
  )
});
