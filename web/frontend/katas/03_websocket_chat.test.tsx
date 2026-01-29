import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import React from "react";
import { render, screen, waitFor, fireEvent, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useWebSocket, Chat } from "./03_websocket_chat";

afterEach(cleanup);

// Mock WebSocket for testing.
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

  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  // Test helpers
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.();
  }
  simulateMessage(data: string) {
    this.onmessage?.({ data });
  }
  simulateClose() {
    this.readyState = 3;
    this.onclose?.();
  }
  simulateError() {
    this.onerror?.(new Event("error"));
  }
}

describe("WebSocket Chat", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    // @ts-expect-error — replacing global WebSocket with mock
    globalThis.WebSocket = MockWebSocket;
  });

  // Write your tests here.
  // See specs/03_websocket_chat.md for what to test.
  //
  // Suggested test structure:
  //
  // describe("useWebSocket", () => {
  //   it("status transitions: connecting → connected on open", () => {})
  //   it("calls onMessage when message received", () => {})
  //   it("send() delivers data when connected", () => {})
  //   it("send() queues data when disconnected, flushes on reconnect", () => {})
  //   it("reconnects with exponential backoff", () => {})
  //   it("disconnect() closes without reconnection", () => {})
  //   it("stops reconnecting after maxRetries", () => {})
  // })
  //
  // describe("Chat component", () => {
  //   it("renders incoming messages", () => {})
  //   it("self-messages have data-sender='self'", () => {})
  //   it("send button dispatches message", () => {})
  //   it("Enter key sends message", () => {})
  //   it("input clears after send", () => {})
  //   it("status indicator reflects connection state", () => {})
  // })
});
