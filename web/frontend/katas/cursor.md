# Cursor Frontend Interview Prep

> Notes on accuracy: Cursor’s interview format and the CoderPad environment can vary by interviewer and over time. Treat this as a checklist of *likely* expectations and verify the specifics (React version, TypeScript availability, test runner, libraries) in the first few minutes of the session.

## Interview Description

> You'll be pairing with one of our engineers to work on a coding problem, where you'll build a React component. You will use a CoderPad pad which the interviewer will share in the chat. We will evaluate code correctness, API design, and test quality more than styling or component structure.

---

## What They're Evaluating (in order)

| Priority | Area | What it means |
|----------|------|---------------|
| 1 | **Code correctness** | It works. Edge cases handled. No bugs. |
| 2 | **API design** | Component props are intuitive, minimal, composable. Good naming. |
| 3 | **Test quality** | Tests cover behavior, not implementation. Edge cases tested. |
| Lower | Styling | They said they care less about this |
| Lower | Component structure | Internal organization matters less than external API |

This tells you where to spend time. Don't polish CSS. Don't over-engineer internal abstractions. Focus on: does it work, is the API clean, are the tests good.

---

## Cursor Product Context

Cursor is an AI code editor. Their frontend likely involves:

- **Streaming AI responses** — rendering tokens as they arrive
- **Diff views** — showing code changes from AI suggestions
- **Code editing** — syntax highlighting, selections, cursors
- **File trees** — navigation, expansion, selection
- **Real-time collaboration** — OT/CRDT, presence indicators
- **Command palette / search** — fuzzy matching, keyboard navigation

Your katas (autocomplete, streaming text, diff viewer, drag reorder, websocket chat) cover the core patterns. The interview problem will likely be a variation or combination.

---

## Reported / Likely Problem Types

Based on Cursor's product and common frontend interview patterns (exact prompt varies):

### High probability

1. **Streaming text renderer** — See `web/frontend/katas/02_streaming_text.approach.md` and `web/frontend/katas/02_streaming_text.solution.tsx`. Know ReadableStream, cancellation, cleanup on unmount.

2. **Autocomplete / command palette** — See `web/frontend/katas/01_autocomplete.approach.md` and `web/frontend/katas/01_autocomplete.solution.tsx`. Know debouncing, stale request handling, keyboard navigation.

3. **Diff viewer (simplified)** — See `web/frontend/katas/04_diff_viewer.approach.md` and `web/frontend/katas/04_diff_viewer.solution.tsx`. Know LCS basics, but they might give you the diff and ask you to build the UI + accept/reject logic.

4. **Virtualized list** — See `web/frontend/katas/06_virtualized_list.approach.md` and `web/frontend/katas/06_virtualized_list.solution.tsx`. Render 10,000 items efficiently (fixed-height windowing in interviews is common).

5. **Expandable tree** — See `web/frontend/katas/07_expandable_tree.approach.md` and `web/frontend/katas/07_expandable_tree.solution.tsx`. File tree with lazy loading + keyboard navigation.

### Medium probability

6. **Multi-cursor selection** — See `web/frontend/katas/08_multi_cursor_selection.approach.md` and `web/frontend/katas/08_multi_cursor_selection.solution.tsx`. Track multiple selection ranges, handle overlaps.

7. **Undo/redo stack** — See `web/frontend/katas/09_undo_redo_stack.approach.md` and `web/frontend/katas/09_undo_redo_stack.solution.tsx`. Maintain history + branching (new edits clear redo).

8. **Presence indicators** — See `web/frontend/katas/10_presence_indicators.approach.md` and `web/frontend/katas/10_presence_indicators.solution.tsx`. Show remote cursors + throttle updates.

9. **Tooltip/popover positioning** — See `web/frontend/katas/11_popover_positioning.approach.md` and `web/frontend/katas/11_popover_positioning.solution.tsx`. Position relative to anchor, flip/clamp near edges.

10. **Form with validation** — See `web/frontend/katas/12_form_validation.approach.md` and `web/frontend/katas/12_form_validation.solution.tsx`. Async validation + stale request handling.

---

## Accessibility (Often Implicitly Evaluated)

Even if they don’t explicitly ask for accessibility, a few basics are “free points” and prevent bugs:

- **Keyboard support**: tab order, arrow key navigation where relevant, Enter/Escape behaviors.
- **Focus management**: when menus/popovers open/close, ensure focus is predictable.
- **Semantic elements**: prefer native inputs/buttons; they come with keyboard + ARIA “for free”.
- **Testing by role**: if you can `getByRole`, your DOM is likely more accessible.

If you build an autocomplete/command palette, consider the ARIA patterns (don’t overdo it in a 45‑min session):
- A simple approach: input + `role="listbox"` with options `role="option"`, and keep highlighted option in view.
- More complete: `role="combobox"` and `aria-activedescendant` for highlighted option ID.

---

## API Design Principles

Since they're evaluating API design, know these patterns:

### 1. Inversion of Control

```tsx
// Bad: component owns the data
<Autocomplete endpoint="/api/search" />

// Good: consumer controls data fetching
<Autocomplete
  fetchSuggestions={(q) => fetch(`/api/search?q=${q}`).then(r => r.json())}
/>
```

The consumer might want caching, different endpoints, mock data in tests. Don't bake in assumptions.

### 2. Controlled vs Uncontrolled

```tsx
// Uncontrolled: component owns state
<Input defaultValue="hello" />

// Controlled: parent owns state
<Input value={value} onChange={setValue} />

// Best: support both
<Input
  value={valueProp}           // controlled if provided
  defaultValue="hello"        // uncontrolled fallback
  onChange={onChange}
/>
```

### 3. Render Props / Children as Function

```tsx
// When consumers need custom rendering
<Autocomplete
  fetchSuggestions={fetch}
  renderSuggestion={(item, { isHighlighted }) => (
    <div className={isHighlighted ? 'highlighted' : ''}>
      {item.name}
    </div>
  )}
/>
```

### 4. Imperative Handles (sparingly)

```tsx
// When parent needs to trigger actions
const ref = useRef<StreamingTextHandle>(null);
ref.current?.start();
ref.current?.stop();

// Expose via useImperativeHandle
useImperativeHandle(ref, () => ({
  start: () => { ... },
  stop: () => { ... },
}));
```

### 5. Minimal Props

Ask: "Can this be derived?" If yes, don't make it a prop.

```tsx
// Bad: redundant props
<List items={items} count={items.length} isEmpty={items.length === 0} />

// Good: derive inside
<List items={items} />
// count and isEmpty computed internally
```

---

## Test Quality Patterns

Since they're evaluating tests:

### Test behavior, not implementation

```tsx
// Bad: testing implementation
expect(component.state.isLoading).toBe(true);

// Good: testing behavior
expect(screen.getByText(/loading/i)).toBeInTheDocument();
```

### Prefer role/text queries; use data-testid when needed

```tsx
// In component
<div data-testid="error">Error occurred</div>

// In test
expect(screen.getByTestId('error')).toHaveTextContent('Error occurred');
```

### Test user interactions

```tsx
// Simulate real user behavior
const user = userEvent.setup();
await user.type(input, 'hello');
await user.keyboard('{ArrowDown}');
await user.click(screen.getByRole('option', { name: 'suggestion 1' }));
```

### Test edge cases explicitly

```tsx
test('handles empty results', ...);
test('handles fetch error', ...);
test('cancels stale requests', ...);
test('cleans up on unmount', ...);
```

### Async testing

```tsx
// Wait for async operations
await waitFor(() => {
  expect(screen.getByText('Results')).toBeInTheDocument();
});

// Or use findBy (waits automatically)
const results = await screen.findByTestId('results');
```

---

## CoderPad Environment

This varies. Verify quickly by scanning imports / `package.json` in the pad and asking what’s allowed.

Common setup is something like:
- React (often 18) with hooks
- Testing Library (`@testing-library/react`) + `@testing-library/user-event`
- Jest- or Vitest-style runner
- TypeScript may or may not be enabled (ask)
- Usually no component library; basic CSS or inline styles are fine

### Starter pattern

CoderPad usually gives you:

```tsx
// App.tsx
export function MyComponent(props) {
  // TODO
}

// App.test.tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from './App';

test('basic test', () => {
  render(<MyComponent />);
  // TODO
});
```

---

## Interview Strategy

### First 3-5 minutes: Clarify

Ask questions before coding:

- "What should happen when X fails?"
- "Should the component be controlled or uncontrolled?"
- "Are there accessibility requirements?"
- "What's the expected scale? (10 items vs 10,000)"

### While coding

1. **Type the skeleton first** — Props interface, basic JSX structure, empty handlers
2. **Get something rendering** — Even if incomplete, show progress
3. **Talk through decisions** — "I'm using useRef here because..."
4. **Handle happy path first** — Then add error/edge cases
5. **Write tests as you go** — Don't leave them for the end

### If stuck

- Say what you're thinking
- Ask for hints ("Am I on the right track with X?")
- Simplify: get a minimal version working, then extend

### Time management

Rough splits for 45 min:
- 5 min: clarify requirements
- 25 min: implement core functionality
- 10 min: tests
- 5 min: edge cases / polish

If you're at 30 min and haven't started tests, mention it: "I want to make sure I have time for tests, let me write a few now."

---

## Common Mistakes to Avoid

| Mistake | Why it hurts |
|---------|--------------|
| Starting to code before clarifying | You might build the wrong thing |
| Over-engineering internally | They said structure matters less. Keep it simple. |
| Forgetting cleanup | Memory leaks in useEffect. Always return cleanup function for subscriptions/timers. |
| Not handling loading/error states | Basic UX. Always ask about these. |
| Leaving tests for last | You'll run out of time. Write them incrementally. |
| Fighting the environment | Don't waste time on tooling. Use what CoderPad gives you. |

---

## Quick Reference: Hooks You'll Need

```tsx
// State
const [value, setValue] = useState(initialValue);

// Side effects with cleanup
useEffect(() => {
  const controller = new AbortController();
  void fetch(url, { signal: controller.signal });
  return () => controller.abort();
}, [url]);

// Refs (DOM or mutable values)
const inputRef = useRef<HTMLInputElement>(null);
// Prefer aborting requests / unsubscribing over "isMounted" flags.

// Memoization (expensive computations)
const processed = useMemo(() => expensiveWork(data), [data]);

// Stable callbacks
const handleClick = useCallback(() => { ... }, [deps]);

// Imperative handle
useImperativeHandle(ref, () => ({ start, stop }), []);
```

---

## Edge Cases to Proactively Mention (Signals Seniority)

If relevant to the prompt, explicitly call out and/or test:

- **Stale async results**: “If request A resolves after request B, ignore A.”
- **Cancellation**: abort fetch / stop timers on unmount and when restarting.
- **React 18 dev behavior**: effects may run twice under StrictMode; keep effects idempotent.
- **Large lists**: avoid rendering 10k nodes; consider windowing.
- **Layout measurement**: if you must measure DOM, consider `useLayoutEffect` and avoid thrashing.

---

## Pre-Interview Checklist

- [ ] Laptop ready (not iPad)
- [ ] Quiet environment, good internet
- [ ] Water nearby
- [ ] CoderPad link open and tested
- [ ] Whiteboard/paper for quick sketches if needed
- [ ] This doc open for quick reference

---

## The Switch Point

Remember from the Apple interview:

> When you say "ok, I understand the problem, now I need to enumerate the cases" — that's when you switch from whiteboard to keyboard.

Discovery phase → whiteboard/paper
Implementation phase → laptop

Don't write code by hand when you could be typing.
