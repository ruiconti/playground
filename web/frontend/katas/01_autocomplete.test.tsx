import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import React from "react";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Autocomplete } from "./01_autocomplete";

afterEach(cleanup);

function mockFetch(results: string[], delay = 0): jest.Mock {
  return jest.fn(
    (_query: string) =>
      new Promise<string[]>((resolve) =>
        setTimeout(() => resolve(results), delay)
      )
  );
}

function mockFetchError(): jest.Mock {
  return jest.fn(() => Promise.reject(new Error("network error")));
}

describe("Autocomplete", () => {
  // Write your tests here.
  // See specs/01_autocomplete.md for what to test.
  //
  // Suggested test structure:
  //
  // describe("fetching", () => {
  //   it("calls fetchSuggestions after debounce delay", async () => {})
  //   it("does not call fetchSuggestions on empty input", async () => {})
  //   it("only uses latest fetch result (stale request guard)", async () => {})
  // })
  //
  // describe("keyboard navigation", () => {
  //   it("ArrowDown highlights next suggestion", async () => {})
  //   it("ArrowUp highlights previous suggestion", async () => {})
  //   it("Enter selects highlighted suggestion", async () => {})
  //   it("Escape closes suggestion list", async () => {})
  // })
  //
  // describe("selection", () => {
  //   it("clicking a suggestion calls onSelect", async () => {})
  //   it("input value updates to selected text", async () => {})
  // })
  //
  // describe("states", () => {
  //   it("shows loading indicator while fetching", async () => {})
  //   it("shows 'No results' for empty results", async () => {})
  //   it("shows error state on fetch failure", async () => {})
  // })
});
