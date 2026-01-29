# Kata 1: Autocomplete — Approach

## What Interviewers Actually Evaluate

| Signal | What they're looking for |
|--------|--------------------------|
| **Race conditions** | Do you understand that responses can arrive out of order? Can you articulate why and how to guard against it? |
| **Debounce vs throttle** | Can you explain the difference without looking it up? (Debounce: fire once after inactivity. Throttle: fire at most once per interval.) |
| **Controlled components** | Do you instinctively reach for controlled input, or do you fight React's model? |
| **Keyboard accessibility** | Do you think about a11y unprompted, or only when asked? |
| **State modeling** | Is your state shape minimal and unambiguous? Can you derive UI from it without conditionals scattered everywhere? |

---

## iPad Sketch

```
┌─────────────────────────────┐
│ [input]                     │
├─────────────────────────────┤
│ ● Loading...                │  ← mutually exclusive with results/error/empty
├─────────────────────────────┤
│ ▸ Suggestion 1  [highlight] │  ← highlightIndex: number (-1 = none)
│   Suggestion 2              │
│   Suggestion 3              │
└─────────────────────────────┘

State:
  inputValue: string
  suggestions: string[]
  status: 'idle' | 'loading' | 'success' | 'error'
  highlightIndex: number
  isOpen: boolean

Refs (not state — no re-render needed):
  debounceTimerRef: timeout ID
  requestIdRef: number (stale request guard)
```

---

## Questions to Ask Interviewer

Ask these before coding to show you think about requirements:

1. "Should empty input clear results immediately, or should I debounce that too?"
   - (Usually: clear immediately, don't waste a network round-trip)

2. "What happens if the user presses Enter with no highlighted item?"
   - (Options: submit form, select first, do nothing)

3. "Should I use AbortController to actually cancel the fetch, or just ignore stale responses?"
   - (AbortController is production-grade; request ID is interview-acceptable)

---

## Implementation Order

Build in this order to show methodical thinking:

### 1. Controlled input → direct fetch (no debounce)
Get the data flowing. Verify suggestions appear.

### 2. Add debounce
```tsx
const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleChange = (e) => {
  const value = e.target.value;
  setInputValue(value);

  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

  if (!value.trim()) {
    // Clear immediately — no network call needed
    setSuggestions([]);
    return;
  }

  debounceTimerRef.current = setTimeout(() => {
    doFetch(value);
  }, debounceMs);
};
```

### 3. Add stale request guard

This is the critical part interviewers probe on:

```tsx
const requestIdRef = useRef(0);

const doFetch = async (query: string) => {
  const thisRequest = ++requestIdRef.current;
  setStatus('loading');

  try {
    const results = await fetchSuggestions(query);

    // CRITICAL: Check if this response is still relevant
    if (thisRequest !== requestIdRef.current) return;

    setSuggestions(results);
    setStatus('success');
  } catch {
    if (thisRequest !== requestIdRef.current) return;
    setStatus('error');
  }
};
```

**Why this works:** Each fetch increments `requestIdRef`. If the user types again before the response arrives, `requestIdRef.current` will have moved on. The stale response sees a mismatch and bails.

### 4. Keyboard navigation

Single handler, switch statement:

```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (!isOpen) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setHighlightIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : 0  // wrap
      );
      break;
    case 'ArrowUp':
      e.preventDefault();
      setHighlightIndex(prev =>
        prev > 0 ? prev - 1 : suggestions.length - 1  // wrap
      );
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightIndex >= 0) {
        selectSuggestion(suggestions[highlightIndex]);
      }
      break;
    case 'Escape':
      e.preventDefault();
      setIsOpen(false);
      break;
  }
};
```

### 5. ARIA attributes

```tsx
<input
  role="combobox"
  aria-expanded={isOpen}
  aria-controls="listbox-id"
  aria-activedescendant={highlightIndex >= 0 ? `option-${highlightIndex}` : undefined}
  aria-autocomplete="list"
/>

<ul id="listbox-id" role="listbox">
  {suggestions.map((s, i) => (
    <li
      key={`${i}-${s}`}  // NOT just key={s} — duplicates break React
      id={`option-${i}`}
      role="option"
      aria-selected={i === highlightIndex}
    >
      {s}
    </li>
  ))}
</ul>
```

---

## Red Flags That Sink Candidates

| Mistake | Why it's a red flag |
|---------|---------------------|
| Using `useEffect` to trigger fetch from query state | Shows misunderstanding of React's data flow. Fetch should happen in the event handler, not as a side effect of state. |
| Leading-edge debounce | Fires immediately on first keystroke, defeating the purpose. Shows you don't understand debounce. |
| `key={suggestion}` on list items | Breaks with duplicate suggestions. Shows you don't understand React's reconciliation. |
| Forgetting `e.preventDefault()` on keyboard events | Arrow keys will scroll the page. Shows lack of attention to detail. |
| Putting suggestions in useEffect deps | Infinite loop or stale closure. Shows you don't understand hooks. |

---

## Edge Cases to Handle

- **Empty input**: Clear suggestions immediately, don't fetch
- **Whitespace-only input**: Treat as empty
- **Click outside**: Close the dropdown (blur handler)
- **Click on suggestion**: Use `onMouseDown` with `e.preventDefault()` to prevent blur from firing first
- **Re-focus input**: Re-open dropdown if suggestions exist

---

## Production Concerns (Follow-up Discussion)

If interviewer asks "how would you improve this for production?":

1. **AbortController**: Actually cancel pending requests, don't just ignore them
2. **Request caching**: LRU cache for recent queries
3. **Minimum query length**: Don't fetch for single characters
4. **Virtualization**: For long suggestion lists
5. **Highlight matching text**: Bold the substring that matches the query
