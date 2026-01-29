# Kata 1 — Autocomplete Search

## Context

You're building a search component for a product that queries a remote API as the user types. The component should feel responsive, avoid unnecessary network requests, and be keyboard-navigable.

This is a common CoderPad interview problem and has been directly reported as an Apple frontend interview question.

---

## Goal

Implement an `Autocomplete` React component that:

- Accepts user input and fetches suggestions from a provided async function
- Debounces keystrokes to avoid excessive API calls
- Supports full keyboard navigation (arrow keys, Enter, Escape)
- Cancels stale requests when the user types again
- Shows loading and empty states

---

## API

```tsx
type AutocompleteProps = {
  /** Async function that returns suggestions for a query string. */
  fetchSuggestions: (query: string) => Promise<string[]>;
  /** Called when the user selects a suggestion. */
  onSelect: (value: string) => void;
  /** Debounce delay in ms. Default: 300 */
  debounceMs?: number;
  /** Placeholder text for the input. */
  placeholder?: string;
};

export function Autocomplete(props: AutocompleteProps): JSX.Element {
  throw new Error("TODO");
}
```

---

## Behavior

### Input & Fetching

- On each keystroke (after debounce), call `fetchSuggestions(query)`.
- If the input is empty, clear suggestions without calling `fetchSuggestions`.
- If a new keystroke arrives before the previous fetch resolves, the previous result must be discarded (not rendered). Use `AbortController` or a stale-request guard.

### Suggestion List

- Render suggestions as a `<ul>` with `role="listbox"`.
- Each suggestion is a `<li>` with `role="option"`.
- Clicking a suggestion calls `onSelect(value)`, sets the input value to the selected text, and closes the list.

### Keyboard Navigation

- **ArrowDown**: move highlight to next suggestion (wrap to first from last).
- **ArrowUp**: move highlight to previous suggestion (wrap to last from first).
- **Enter**: select the highlighted suggestion (same as clicking it).
- **Escape**: close the suggestion list without selecting.
- The highlighted item should have `aria-selected="true"`.

### States

- **Loading**: while `fetchSuggestions` is pending, show a loading indicator (element with `data-testid="loading"`).
- **No results**: if `fetchSuggestions` returns `[]`, show text "No results" (element with `data-testid="no-results"`).
- **Error**: if `fetchSuggestions` throws, show text "Error fetching results" (element with `data-testid="error"`).

---

## Tests you should write

### Core behavior

- Typing triggers fetch after debounce delay
- Fast sequential typing only triggers one fetch (debounce works)
- Selecting a suggestion calls `onSelect` with correct value
- Input value updates to selected suggestion text

### Stale request handling

- If user types "ab" then quickly "abc", only "abc" results render (not "ab" results arriving late)

### Keyboard navigation

- ArrowDown/ArrowUp cycles through suggestions
- Enter selects highlighted item
- Escape closes the list

### Edge cases

- Empty input clears suggestions
- Fetch error shows error state
- Empty results array shows "No results"

---

## Follow-up ladder (do not implement unless asked)

1. Add an LRU cache: if the same query was fetched recently, return cached results without a network call.
2. Highlight the matching substring in each suggestion.
3. Support multi-section results (e.g., "Recent" and "Suggested" groups).
