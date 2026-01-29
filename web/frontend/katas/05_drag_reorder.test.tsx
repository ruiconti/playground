import { describe, it, expect, afterEach, jest } from "bun:test";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReorderList } from "./05_drag_reorder";

afterEach(cleanup);

const sampleItems = [
  { id: "1", content: "First" },
  { id: "2", content: "Second" },
  { id: "3", content: "Third" },
];

describe("ReorderList", () => {
  // Write your tests here.
  // See specs/05_drag_reorder.md for what to test.
  //
  // Suggested test structure:
  //
  // describe("rendering", () => {
  //   it("renders all items in order", () => {})
  //   it("items have correct data-testid", () => {})
  //   it("items have correct aria-labels", () => {})
  // })
  //
  // describe("drag-and-drop", () => {
  //   it("dragstart sets visual state", () => {})
  //   it("dragover shows drop indicator", () => {})
  //   it("drop reorders and calls onReorder", () => {})
  //   it("dragend clears visual state", () => {})
  // })
  //
  // describe("keyboard reordering", () => {
  //   it("Alt+ArrowDown moves item down", () => {})
  //   it("Alt+ArrowUp moves item up", () => {})
  //   it("no-op at boundaries", () => {})
  //   it("focus follows moved item", () => {})
  // })
  //
  // describe("accessibility", () => {
  //   it("aria-labels update after reorder", () => {})
  //   it("live region announces new position", () => {})
  // })
});
