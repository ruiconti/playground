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

Each stage shows complete working code. New/changed lines marked with `// ← NEW`.

---

### Stage 1: Controlled input with direct fetch

No debounce yet. Just get data flowing.

```tsx
type AutocompleteProps = {
  fetchSuggestions: (query: string) => Promise<string[]>;
  onSelect: (value: string) => void;
  debounceMs?: number;
};

export function Autocomplete({
  fetchSuggestions,
  onSelect,
}: AutocompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (!value.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setStatus('loading');
    try {
      const results = await fetchSuggestions(value);
      setSuggestions(results);
      setStatus('success');
      setIsOpen(results.length > 0);
    } catch {
      setStatus('error');
    }
  };

  const handleSelect = (suggestion: string) => {
    setInputValue(suggestion);
    setIsOpen(false);
    onSelect(suggestion);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      />

      {status === 'loading' && <div>Loading...</div>}

      {isOpen && suggestions.length > 0 && (
        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}>
          {suggestions.map((s, i) => (
            <li key={`${i}-${s}`} onClick={() => handleSelect(s)}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Problem with Stage 1**: Every keystroke fires a fetch. Types "hello" = 5 fetches.

---

### Stage 2: Add debounce

Wait for pause in typing before fetching.

```tsx
type AutocompleteProps = {
  fetchSuggestions: (query: string) => Promise<string[]>;
  onSelect: (value: string) => void;
  debounceMs?: number;
};

export function Autocomplete({
  fetchSuggestions,
  onSelect,
  debounceMs = 300,                                     // ← NEW
}: AutocompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isOpen, setIsOpen] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);  // ← NEW

  // ← NEW: Separate fetch logic
  const doFetch = async (query: string) => {
    setStatus('loading');
    try {
      const results = await fetchSuggestions(query);
      setSuggestions(results);
      setStatus('success');
      setIsOpen(results.length > 0);
    } catch {
      setStatus('error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // ← NEW: Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // ← NEW: Schedule fetch after delay
    debounceTimerRef.current = setTimeout(() => {
      doFetch(value);
    }, debounceMs);
  };

  const handleSelect = (suggestion: string) => {
    setInputValue(suggestion);
    setIsOpen(false);
    onSelect(suggestion);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      />

      {status === 'loading' && <div>Loading...</div>}

      {isOpen && suggestions.length > 0 && (
        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}>
          {suggestions.map((s, i) => (
            <li key={`${i}-${s}`} onClick={() => handleSelect(s)}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Problem with Stage 2**: Type "ab" fast, pause. Slow response for "a" arrives after fast response for "ab". Stale data overwrites correct data.

---

### Stage 3: Stale request guard

Ignore responses that arrive after newer requests.

```tsx
type AutocompleteProps = {
  fetchSuggestions: (query: string) => Promise<string[]>;
  onSelect: (value: string) => void;
  debounceMs?: number;
};

export function Autocomplete({
  fetchSuggestions,
  onSelect,
  debounceMs = 300,
}: AutocompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isOpen, setIsOpen] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);                       // ← NEW

  const doFetch = async (query: string) => {
    const thisRequest = ++requestIdRef.current;         // ← NEW: Increment before fetch
    setStatus('loading');

    try {
      const results = await fetchSuggestions(query);

      // ← NEW: Check if this response is still relevant
      if (thisRequest !== requestIdRef.current) return;

      setSuggestions(results);
      setStatus('success');
      setIsOpen(results.length > 0);
    } catch {
      // ← NEW: Also check on error path
      if (thisRequest !== requestIdRef.current) return;
      setStatus('error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      doFetch(value);
    }, debounceMs);
  };

  const handleSelect = (suggestion: string) => {
    setInputValue(suggestion);
    setIsOpen(false);
    onSelect(suggestion);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      />

      {status === 'loading' && <div>Loading...</div>}

      {isOpen && suggestions.length > 0 && (
        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}>
          {suggestions.map((s, i) => (
            <li key={`${i}-${s}`} onClick={() => handleSelect(s)}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Problem with Stage 3**: No keyboard navigation. Users can't arrow through suggestions.

---

### Stage 4: Keyboard navigation

Arrow keys to navigate, Enter to select, Escape to close.

```tsx
type AutocompleteProps = {
  fetchSuggestions: (query: string) => Promise<string[]>;
  onSelect: (value: string) => void;
  debounceMs?: number;
};

export function Autocomplete({
  fetchSuggestions,
  onSelect,
  debounceMs = 300,
}: AutocompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);  // ← NEW

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const doFetch = async (query: string) => {
    const thisRequest = ++requestIdRef.current;
    setStatus('loading');

    try {
      const results = await fetchSuggestions(query);
      if (thisRequest !== requestIdRef.current) return;

      setSuggestions(results);
      setHighlightIndex(-1);                            // ← NEW: Reset highlight
      setStatus('success');
      setIsOpen(results.length > 0);
    } catch {
      if (thisRequest !== requestIdRef.current) return;
      setStatus('error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      doFetch(value);
    }, debounceMs);
  };

  const handleSelect = (suggestion: string) => {
    setInputValue(suggestion);
    setIsOpen(false);
    setHighlightIndex(-1);                              // ← NEW
    onSelect(suggestion);
  };

  // ← NEW: Keyboard handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0) {
          handleSelect(suggestions[highlightIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}                       // ← NEW
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      />

      {status === 'loading' && <div>Loading...</div>}

      {isOpen && suggestions.length > 0 && (
        <ul style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}>
          {suggestions.map((s, i) => (
            <li
              key={`${i}-${s}`}
              onClick={() => handleSelect(s)}
              style={{                                  // ← NEW: Highlight style
                backgroundColor: i === highlightIndex ? '#e0e0e0' : 'transparent',
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Problem with Stage 4**: Click on suggestion doesn't work reliably. Blur fires before click, closing the dropdown.

---

### Stage 5: Fix blur/click race + ARIA (Final)

Use onMouseDown with preventDefault to fix blur race. Add ARIA for screen readers.

```tsx
type AutocompleteProps = {
  fetchSuggestions: (query: string) => Promise<string[]>;
  onSelect: (value: string) => void;
  debounceMs?: number;
};

export function Autocomplete({
  fetchSuggestions,
  onSelect,
  debounceMs = 300,
}: AutocompleteProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const listboxId = 'autocomplete-listbox';             // ← NEW

  const doFetch = async (query: string) => {
    const thisRequest = ++requestIdRef.current;
    setStatus('loading');

    try {
      const results = await fetchSuggestions(query);
      if (thisRequest !== requestIdRef.current) return;

      setSuggestions(results);
      setHighlightIndex(-1);
      setStatus('success');
      setIsOpen(results.length > 0);
    } catch {
      if (thisRequest !== requestIdRef.current) return;
      setStatus('error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      doFetch(value);
    }, debounceMs);
  };

  const handleSelect = (suggestion: string) => {
    setInputValue(suggestion);
    setIsOpen(false);
    setHighlightIndex(-1);
    onSelect(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0) {
          handleSelect(suggestions[highlightIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // ← NEW: Prevent blur from firing before click
  const handleSuggestionMouseDown = (e: React.MouseEvent, suggestion: string) => {
    e.preventDefault();  // Prevents blur
    handleSelect(suggestion);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        role="combobox"                                 // ← NEW: ARIA
        aria-expanded={isOpen}                          // ← NEW
        aria-controls={listboxId}                       // ← NEW
        aria-activedescendant={                         // ← NEW
          highlightIndex >= 0 ? `option-${highlightIndex}` : undefined
        }
        aria-autocomplete="list"                        // ← NEW
      />

      {status === 'loading' && <div>Loading...</div>}

      {isOpen && suggestions.length > 0 && (
        <ul
          id={listboxId}                                // ← NEW
          role="listbox"                                // ← NEW
          style={{ position: 'absolute', top: '100%', left: 0, right: 0 }}
        >
          {suggestions.map((s, i) => (
            <li
              key={`${i}-${s}`}
              id={`option-${i}`}                        // ← NEW
              role="option"                             // ← NEW
              aria-selected={i === highlightIndex}      // ← NEW
              onMouseDown={(e) => handleSuggestionMouseDown(e, s)}  // ← CHANGED
              style={{
                backgroundColor: i === highlightIndex ? '#e0e0e0' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**This is the complete component.** Each stage addressed a specific gap:
1. Direct fetch → works but spams network
2. Debounce → efficient but stale responses corrupt state
3. Request ID guard → correct but mouse-only
4. Keyboard nav → accessible but blur/click race condition
5. MouseDown + ARIA → production-ready

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
