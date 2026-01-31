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

## First 2 Minutes: Break It Down (Before Coding)

Treat it as “compute an insertion index” + “apply reorder”:

```
dragstart -> dragover (compute dropIndex) -> drop (reorder) -> cleanup
```

Concrete chunks:
1. **Data model**: `draggedIndex`, `dropTarget { index, position }`.
2. **Drop math**: top/bottom half → insertion index; detect no-op drops.
3. **Reorder helper**: pure `move(items, from, to)` function.
4. **Wire events**: `onDragStart/Over/Drop/End` with required `preventDefault()`.
5. **Keyboard support**: alt+up/down (or similar) reorders, focus follows item.
6. **Announcements**: `aria-live` message (time-permitting).

---

## Implementation Order

Each stage shows complete working code. New/changed lines marked with `// ← NEW`.

---

### Stage 1: Basic draggable list (no reorder yet)

Just render items with `draggable` attribute. Nothing happens on drag.

```tsx
import React from 'react';

type ReorderItem = {
  id: string;
  content: string;
};

type ReorderListProps = {
  items: ReorderItem[];
  onReorder: (items: ReorderItem[]) => void;
  renderItem?: (item: ReorderItem) => React.ReactNode;
};

export function ReorderList({
  items,
  onReorder,
  renderItem,
}: ReorderListProps): React.ReactElement {
  return (
    <div>
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, index) => (
          <li
            key={item.id}
            role="listitem"
            draggable
            tabIndex={0}
            aria-label={`${item.content}, item ${index + 1} of ${items.length}`}
            style={{
              padding: '12px 16px',
              margin: '4px 0',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'grab',
            }}
          >
            {renderItem ? renderItem(item) : item.content}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Problem with Stage 1**: Items are draggable but nothing happens. No drop indicator, no reordering.

---

### Stage 2: Track drag state + show drop indicator

Track which item is being dragged and where it would drop.

```tsx
import React, { useState } from 'react';

type ReorderItem = {
  id: string;
  content: string;
};

type ReorderListProps = {
  items: ReorderItem[];
  onReorder: (items: ReorderItem[]) => void;
  renderItem?: (item: ReorderItem) => React.ReactNode;
};

type DropTarget = {                                     // ← NEW
  index: number;
  position: 'above' | 'below';
} | null;

export function ReorderList({
  items,
  onReorder,
  renderItem,
}: ReorderListProps): React.ReactElement {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);  // ← NEW
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);          // ← NEW

  // ← NEW: Drag start
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  // ← NEW: Drag over - calculate drop position
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();  // REQUIRED — without this, drop won't fire!
    if (draggedIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: 'above' | 'below' = e.clientY < midpoint ? 'above' : 'below';

    // Calculate effective drop index
    const dropIndex = position === 'above' ? index : index + 1;

    // Don't show indicator at no-op positions
    if (dropIndex === draggedIndex || dropIndex === draggedIndex + 1) {
      setDropTarget(null);
      return;
    }

    setDropTarget({ index, position });
  };

  // ← NEW: Drag end - reset state
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  return (
    <div>
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, index) => {
          const isDragged = draggedIndex === index;
          const showIndicatorAbove =
            dropTarget?.index === index && dropTarget.position === 'above';
          const showIndicatorBelow =
            dropTarget?.index === index && dropTarget.position === 'below';

          return (
            <React.Fragment key={item.id}>
              {/* ← NEW: Drop indicator above */}
              {showIndicatorAbove && (
                <div style={{ height: '2px', backgroundColor: '#007bff', margin: '0 8px' }} />
              )}

              <li
                role="listitem"
                draggable
                tabIndex={0}
                aria-label={`${item.content}, item ${index + 1} of ${items.length}`}
                onDragStart={handleDragStart(index)}     // ← NEW
                onDragOver={handleDragOver(index)}       // ← NEW
                onDragEnd={handleDragEnd}                // ← NEW
                style={{
                  padding: '12px 16px',
                  margin: '4px 0',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'grab',
                  opacity: isDragged ? 0.5 : 1,          // ← NEW: Visual feedback
                }}
              >
                {renderItem ? renderItem(item) : item.content}
              </li>

              {/* ← NEW: Drop indicator below */}
              {showIndicatorBelow && (
                <div style={{ height: '2px', backgroundColor: '#007bff', margin: '0 8px' }} />
              )}
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
}
```

**Problem with Stage 2**: Drop indicator shows, but releasing doesn't actually reorder.

---

### Stage 3: Handle drop to reorder

Actually move the item when dropped.

```tsx
import React, { useState, useCallback } from 'react';

type ReorderItem = {
  id: string;
  content: string;
};

type ReorderListProps = {
  items: ReorderItem[];
  onReorder: (items: ReorderItem[]) => void;
  renderItem?: (item: ReorderItem) => React.ReactNode;
};

type DropTarget = {
  index: number;
  position: 'above' | 'below';
} | null;

export function ReorderList({
  items,
  onReorder,
  renderItem,
}: ReorderListProps): React.ReactElement {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  // ← NEW: Reorder helper
  const reorderItems = useCallback(
    (fromIndex: number, toIndex: number): ReorderItem[] => {
      if (fromIndex === toIndex) return items;

      const newItems = [...items];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      return newItems;
    },
    [items]
  );

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: 'above' | 'below' = e.clientY < midpoint ? 'above' : 'below';

    const dropIndex = position === 'above' ? index : index + 1;

    if (dropIndex === draggedIndex || dropIndex === draggedIndex + 1) {
      setDropTarget(null);
      return;
    }

    setDropTarget({ index, position });
  };

  // ← NEW: Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || dropTarget === null) return;

    let insertIndex =
      dropTarget.position === 'above' ? dropTarget.index : dropTarget.index + 1;

    // Adjust for removal: if dragging from before insert point
    if (draggedIndex < insertIndex) {
      insertIndex--;
    }

    const newItems = reorderItems(draggedIndex, insertIndex);
    onReorder(newItems);

    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  return (
    <div>
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, index) => {
          const isDragged = draggedIndex === index;
          const showIndicatorAbove =
            dropTarget?.index === index && dropTarget.position === 'above';
          const showIndicatorBelow =
            dropTarget?.index === index && dropTarget.position === 'below';

          return (
            <React.Fragment key={item.id}>
              {showIndicatorAbove && (
                <div style={{ height: '2px', backgroundColor: '#007bff', margin: '0 8px' }} />
              )}

              <li
                role="listitem"
                draggable
                tabIndex={0}
                aria-label={`${item.content}, item ${index + 1} of ${items.length}`}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop}                      // ← NEW
                onDragEnd={handleDragEnd}
                style={{
                  padding: '12px 16px',
                  margin: '4px 0',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'grab',
                  opacity: isDragged ? 0.5 : 1,
                }}
              >
                {renderItem ? renderItem(item) : item.content}
              </li>

              {showIndicatorBelow && (
                <div style={{ height: '2px', backgroundColor: '#007bff', margin: '0 8px' }} />
              )}
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
}
```

**Problem with Stage 3**: Drag works, but keyboard users can't reorder. Accessibility fail.

---

### Stage 4: Keyboard reorder (Alt + Arrow)

Add keyboard support with focus management.

```tsx
import React, { useState, useRef, useCallback } from 'react';

type ReorderItem = {
  id: string;
  content: string;
};

type ReorderListProps = {
  items: ReorderItem[];
  onReorder: (items: ReorderItem[]) => void;
  renderItem?: (item: ReorderItem) => React.ReactNode;
};

type DropTarget = {
  index: number;
  position: 'above' | 'below';
} | null;

export function ReorderList({
  items,
  onReorder,
  renderItem,
}: ReorderListProps): React.ReactElement {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);  // ← NEW

  const reorderItems = useCallback(
    (fromIndex: number, toIndex: number): ReorderItem[] => {
      if (fromIndex === toIndex) return items;
      const newItems = [...items];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      return newItems;
    },
    [items]
  );

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: 'above' | 'below' = e.clientY < midpoint ? 'above' : 'below';

    const dropIndex = position === 'above' ? index : index + 1;

    if (dropIndex === draggedIndex || dropIndex === draggedIndex + 1) {
      setDropTarget(null);
      return;
    }

    setDropTarget({ index, position });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || dropTarget === null) return;

    let insertIndex =
      dropTarget.position === 'above' ? dropTarget.index : dropTarget.index + 1;

    if (draggedIndex < insertIndex) insertIndex--;

    const newItems = reorderItems(draggedIndex, insertIndex);
    onReorder(newItems);

    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  // ← NEW: Keyboard handler
  const handleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    if (!e.altKey) return;

    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      const newItems = reorderItems(index, index - 1);
      onReorder(newItems);

      // Focus follows the moved item (use rAF to wait for React to update DOM)
      requestAnimationFrame(() => {
        itemRefs.current[index - 1]?.focus();
      });
    }

    if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault();
      const newItems = reorderItems(index, index + 1);
      onReorder(newItems);

      requestAnimationFrame(() => {
        itemRefs.current[index + 1]?.focus();
      });
    }
  };

  return (
    <div>
      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, index) => {
          const isDragged = draggedIndex === index;
          const showIndicatorAbove =
            dropTarget?.index === index && dropTarget.position === 'above';
          const showIndicatorBelow =
            dropTarget?.index === index && dropTarget.position === 'below';

          return (
            <React.Fragment key={item.id}>
              {showIndicatorAbove && (
                <div style={{ height: '2px', backgroundColor: '#007bff', margin: '0 8px' }} />
              )}

              <li
                ref={(el) => { itemRefs.current[index] = el; }}  // ← NEW
                role="listitem"
                draggable
                tabIndex={0}
                aria-label={`${item.content}, item ${index + 1} of ${items.length}`}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onKeyDown={handleKeyDown(index)}         // ← NEW
                style={{
                  padding: '12px 16px',
                  margin: '4px 0',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'grab',
                  opacity: isDragged ? 0.5 : 1,
                }}
              >
                {renderItem ? renderItem(item) : item.content}
              </li>

              {showIndicatorBelow && (
                <div style={{ height: '2px', backgroundColor: '#007bff', margin: '0 8px' }} />
              )}
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
}
```

**Problem with Stage 4**: Keyboard reorder works, but screen reader users don't know anything happened. Need ARIA live region.

---

### Stage 5: ARIA live announcements (Final)

Announce position changes for screen readers.

```tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';

type ReorderItem = {
  id: string;
  content: string;
};

type ReorderListProps = {
  items: ReorderItem[];
  onReorder: (items: ReorderItem[]) => void;
  renderItem?: (item: ReorderItem) => React.ReactNode;
};

type DropTarget = {
  index: number;
  position: 'above' | 'below';
} | null;

export function ReorderList({
  items,
  onReorder,
  renderItem,
}: ReorderListProps): React.ReactElement {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [announcement, setAnnouncement] = useState('');  // ← NEW

  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);  // ← NEW

  // ← NEW: Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  // ← NEW: Announce helper
  const announce = useCallback((message: string) => {
    if (announceTimerRef.current) {
      clearTimeout(announceTimerRef.current);
    }
    setAnnouncement(message);
    announceTimerRef.current = setTimeout(() => setAnnouncement(''), 1000);
  }, []);

  const reorderItems = useCallback(
    (fromIndex: number, toIndex: number): ReorderItem[] => {
      if (fromIndex === toIndex) return items;
      const newItems = [...items];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      return newItems;
    },
    [items]
  );

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: 'above' | 'below' = e.clientY < midpoint ? 'above' : 'below';

    const dropIndex = position === 'above' ? index : index + 1;

    if (dropIndex === draggedIndex || dropIndex === draggedIndex + 1) {
      setDropTarget(null);
      return;
    }

    setDropTarget({ index, position });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || dropTarget === null) return;

    let insertIndex =
      dropTarget.position === 'above' ? dropTarget.index : dropTarget.index + 1;

    if (draggedIndex < insertIndex) insertIndex--;

    const newItems = reorderItems(draggedIndex, insertIndex);
    onReorder(newItems);

    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    if (!e.altKey) return;

    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      const newItems = reorderItems(index, index - 1);
      onReorder(newItems);

      requestAnimationFrame(() => {
        itemRefs.current[index - 1]?.focus();
      });

      // ← NEW: Announce for screen readers
      announce(`Moved ${items[index].content} to position ${index} of ${items.length}`);
    }

    if (e.key === 'ArrowDown' && index < items.length - 1) {
      e.preventDefault();
      const newItems = reorderItems(index, index + 1);
      onReorder(newItems);

      requestAnimationFrame(() => {
        itemRefs.current[index + 1]?.focus();
      });

      // ← NEW: Announce for screen readers
      announce(`Moved ${items[index].content} to position ${index + 2} of ${items.length}`);
    }
  };

  return (
    <div>
      {/* ← NEW: Screen reader live region (visually hidden) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcement}
      </div>

      <ul role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((item, index) => {
          const isDragged = draggedIndex === index;
          const showIndicatorAbove =
            dropTarget?.index === index && dropTarget.position === 'above';
          const showIndicatorBelow =
            dropTarget?.index === index && dropTarget.position === 'below';

          return (
            <React.Fragment key={item.id}>
              {showIndicatorAbove && (
                <div style={{ height: '2px', backgroundColor: '#007bff', margin: '0 8px' }} />
              )}

              <li
                ref={(el) => { itemRefs.current[index] = el; }}
                role="listitem"
                draggable
                tabIndex={0}
                aria-label={`${item.content}, item ${index + 1} of ${items.length}`}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onKeyDown={handleKeyDown(index)}
                style={{
                  padding: '12px 16px',
                  margin: '4px 0',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'grab',
                  opacity: isDragged ? 0.5 : 1,
                }}
              >
                {renderItem ? renderItem(item) : item.content}
              </li>

              {showIndicatorBelow && (
                <div style={{ height: '2px', backgroundColor: '#007bff', margin: '0 8px' }} />
              )}
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
}
```

**This is the complete component.** Each stage addressed a specific gap:
1. Basic list → renders but no drag behavior
2. Drag state → shows indicator but no reorder
3. Drop handler → reorders but mouse-only
4. Keyboard nav → accessible but silent
5. ARIA live → production-ready

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
