import { describe, it, expect, afterEach, jest } from "bun:test";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { computeDiff, DiffViewer } from "./04_diff_viewer";

afterEach(cleanup);

describe("Diff Viewer", () => {
  // Write your tests here.
  // See specs/04_diff_viewer.md for what to test.
  //
  // Suggested test structure:
  //
  // describe("computeDiff", () => {
  //   it("identical strings → all unchanged", () => {})
  //   it("completely different → removes + adds", () => {})
  //   it("single line added in middle", () => {})
  //   it("single line removed", () => {})
  //   it("empty original → all adds", () => {})
  //   it("empty modified → all removes", () => {})
  // })
  //
  // describe("rendering", () => {
  //   it("lines have correct data-diff-type attributes", () => {})
  //   it("line numbers are correct", () => {})
  //   it("hunk buttons render only for changed hunks", () => {})
  // })
  //
  // describe("hunk resolution", () => {
  //   it("accept updates display to modified version", () => {})
  //   it("reject updates display to original version", () => {})
  //   it("onResolve called with correct merged text", () => {})
  //   it("accept all → resolvedText equals modified", () => {})
  //   it("reject all → resolvedText equals original", () => {})
  // })
});
