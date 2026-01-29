# Kata 5: Drag and Drop Reorder — Approach

## What Interviewers Actually Evaluate

| Signal | What they're looking for |
|--------|--------------------------|
| **HTML5 Drag API** | Do you know the event sequence (dragstart → dragover → drop → dragend)? |
| **Drop position math** | Can you calculate top-half vs bottom-half of an element? |
| **Keyboard accessibility** | Do you build keyboard support as a first-class feature? |
| **Focus management** | Do you move focus to follow the reordered item? |
| **ARIA live regions** | Do you announce changes for screen readers? |

---

## iPad Sketch

```
Drag events sequence:
  dragstart (on dragged item)
  dragover  (on each item cursor passes, fires repeatedly)
  drop      (on release target)
  dragend   (always, even if drop cancelled)

Drop indicator positioning:
  ┌─────────────────────────┐
  │                         │ ← top half → indicator ABOVE
  │ - - - - midpoint - - -  │
  │                         │ ← bottom half → indicator BELOW
  └─────────────────────────┘

  midpoint = rect.top + rect.height / 2
  position = e.clientY < midpoint ? 'above' : 'below'

State:
  draggedIndex: number | null
  dropTarget: { index: number, position: 'above' | 'below' } | null

No-op detection:
  Don't show indicator when drop would result in same position:
  - dropping at draggedIndex (same spot)
  - dropping at draggedIndex + 1 with position 'above' (same spot)
```

```
Keyboard reorder:
  Alt + ↑  →  move item up
  Alt + ↓  →  move item down

  Focus follows the moved item.
  Announce via aria-live: "Moved [item] to position X of Y"
```

---

## Questions to Ask Interviewer

1. "Should keyboard reorder wrap (last → first) or stop at boundaries?"
   - (Usually: stop at boundaries — wrapping is confusing for reorder)

2. "For drag visual, is reduced opacity enough or do you want a drag preview?"
   - (Usually: opacity is fine — custom drag preview is complex)

3. "Does this need to work on touch devices?"
   - (Important: HTML5 drag events don't work on mobile. Would need pointer events.)

---

## Implementation Order

### 1. Basic render with drag attributes

```tsx
<ul role="list">
  {items.map((item, index) => (
    <li
      key={item.id}
      role="listitem"
      draggable
      tabIndex={0}
      data-testid={`item-${item.id}`}
      aria-label={`${item.content}, item ${index + 1} of ${items.length}`}
    >
      {item.content}
    </li>
  ))}
</ul>
```

### 2. Drag state tracking

```tsx
const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
const [dropTarget, setDropTarget] = useState<{
  index: number;
  position: 'above' | 'below';
} | null>(null);
```

### 3. Drag event handlers

```tsx
const handleDragStart = (index: number) => (e: React.DragEvent) => {
  setDraggedIndex(index);
  e.dataTransfer.effectAllowed = 'move';
};

const handleDragOver = (index: number) => (e: React.DragEvent) => {
  e.preventDefault();  // REQUIRED — without this, drop won't fire
  if (draggedIndex === null) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  const position = e.clientY < midpoint ? 'above' : 'below';

  // Calculate effective insert index
  const insertIndex = position === 'above' ? index : index + 1;

  // No-op detection
  if (insertIndex === draggedIndex || insertIndex === draggedIndex + 1) {
    setDropTarget(null);
    return;
  }

  setDropTarget({ index, position });
};

const handleDrop = () => {
  if (draggedIndex === null || dropTarget === null) return;

  let insertIndex = dropTarget.position === 'above'
    ? dropTarget.index
    : dropTarget.index + 1;

  // Adjust for removal (if dragging from before insert point)
  if (draggedIndex < insertIndex) insertIndex--;

  const newItems = reorder(items, draggedIndex, insertIndex);
  onReorder(newItems);

  setDraggedIndex(null);
  setDropTarget(null);
};

const handleDragEnd = () => {
  setDraggedIndex(null);
  setDropTarget(null);
};
```

### 4. Keyboard reorder

```tsx
const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

const handleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
  if (!e.altKey) return;

  if (e.key === 'ArrowUp' && index > 0) {
    e.preventDefault();
    const newItems = reorder(items, index, index - 1);
    onReorder(newItems);

    // Focus follows the moved item
    requestAnimationFrame(() => {
      itemRefs.current[index - 1]?.focus();
    });

    announce(`Moved ${items[index].content} to position ${index} of ${items.length}`);
  }

  if (e.key === 'ArrowDown' && index < items.length - 1) {
    e.preventDefault();
    const newItems = reorder(items, index, index + 1);
    onReorder(newItems);

    requestAnimationFrame(() => {
      itemRefs.current[index + 1]?.focus();
    });

    announce(`Moved ${items[index].content} to position ${index + 2} of ${items.length}`);
  }
};
```

### 5. ARIA live region

```tsx
const [announcement, setAnnouncement] = useState('');

const announce = (message: string) => {
  setAnnouncement(message);
  setTimeout(() => setAnnouncement(''), 1000);
};

// Render (visually hidden but screen-reader accessible):
<div
  aria-live="polite"
  aria-atomic="true"
  style={{
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
  }}
>
  {announcement}
</div>
```

---

## Red Flags That Sink Candidates

| Mistake | Why it's a red flag |
|---------|---------------------|
| Missing `e.preventDefault()` in dragover | Drop event won't fire. This is the #1 drag-and-drop bug. |
| Forgetting to adjust insert index after removal | Off-by-one when dragging upward. Shows lack of careful reasoning. |
| Not using `requestAnimationFrame` for focus | Focus happens before DOM update. Shows unfamiliarity with React's async updates. |
| Showing indicator at no-op positions | Confusing UX. Shows lack of attention to edge cases. |
| No keyboard support | Accessibility failure. Major red flag in 2024+. |

---

## Insert Index Calculation

This is tricky and trips people up:

```
Scenario: Drag item 0 to position below item 2

Before: [A, B, C]  (dragging A, index 0)
        [ ↑ drop here, below C (index 2)]

1. dropTarget = { index: 2, position: 'below' }
2. insertIndex = 2 + 1 = 3
3. Since draggedIndex (0) < insertIndex (3), adjust: insertIndex = 2
4. Remove A: [B, C]
5. Insert at 2: [B, C, A] ✓

Scenario: Drag item 2 to position above item 0

Before: [A, B, C]  (dragging C, index 2)
        [ ↑ drop here, above A (index 0)]

1. dropTarget = { index: 0, position: 'above' }
2. insertIndex = 0
3. Since draggedIndex (2) > insertIndex (0), no adjustment
4. Remove C: [A, B]
5. Insert at 0: [C, A, B] ✓
```

---

## Production Concerns (Follow-up Discussion)

1. **Touch support**: HTML5 drag events don't work on mobile. Need pointer events + manual hit testing.
2. **Smooth animations**: CSS transitions when items shift. Requires tracking previous positions.
3. **Multi-select**: Hold Shift/Cmd to select multiple, drag all at once.
4. **Drop zones**: Drag between different lists (e.g., Trello columns).
5. **Auto-scroll**: When dragging near edges of a scrollable container.
