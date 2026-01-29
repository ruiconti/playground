import React from "react";

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

export const StreamingText = React.forwardRef<
  StreamingTextHandle,
  StreamingTextProps
>(function StreamingText(props, ref) {
  throw new Error("TODO");
});
