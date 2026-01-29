import { describe, it, expect, afterEach, jest } from "bun:test";
import React, { createRef } from "react";
import { render, screen, waitFor, fireEvent, cleanup, act } from "@testing-library/react";
import { StreamingText, type StreamingTextHandle } from "./02_streaming_text";

afterEach(cleanup);

function createMockStream(
  tokens: string[],
  delayMs = 0
): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      for (const token of tokens) {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        controller.enqueue(token);
      }
      controller.close();
    },
  });
}

function createErrorStream(
  tokens: string[],
  errorAfter: number
): ReadableStream<string> {
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

describe("StreamingText", () => {
  // Write your tests here.
  // See specs/02_streaming_text.md for what to test.
  //
  // Suggested test structure:
  //
  // describe("streaming", () => {
  //   it("renders tokens as they arrive", async () => {})
  //   it("calls onDone with full text when stream completes", async () => {})
  // })
  //
  // describe("cancellation", () => {
  //   it("stop button cancels stream", async () => {})
  //   it("onDone receives cancelled: true", async () => {})
  //   it("stop button disappears after cancel", async () => {})
  // })
  //
  // describe("lifecycle", () => {
  //   it("stop button only visible while streaming", async () => {})
  //   it("cursor only visible while streaming", async () => {})
  //   it("start() is a no-op if already streaming", async () => {})
  // })
  //
  // describe("errors", () => {
  //   it("shows error state on stream error", async () => {})
  //   it("preserves accumulated text before error", async () => {})
  // })
});
