# Kata 5 — Drag-and-Drop Reorder

## Context

You're building a task management or media organization tool. Users need to reorder items by dragging them. The component should provide clear visual feedback during the drag and support both mouse and keyboard-based reordering for accessibility.

This problem was reported as an Apple frontend interview question ("photo ordering tool").

---

## Goal

Implement a `ReorderList` React component that:

- Renders a list of items that can be reordered via drag-and-drop
- Provides visual feedback during drag (drop indicator, dragged item styling)
- Supports keyboard-based reordering for accessibility
- Reports the new order after each reorder operation

---

## API

```tsx
type ReorderItem = {
  id: string;
  content: string;
};

type ReorderListProps = {
  items: ReorderItem[];
  /** Called with the new item order after a reorder. */
  onReorder: (items: ReorderItem[]) => void;
  /** Render function for each item. Falls back to item.content if not provided. */
  renderItem?: (item: ReorderItem) => React.ReactNode;
};

export function ReorderList(props: ReorderListProps): JSX.Element {
  throw new Error("TODO");
}
```

---

## Behavior

### Drag-and-Drop (mouse/pointer)

- Each item is a draggable element (`draggable="true"`).
- Each item has `data-testid="item-{id}"`.
- On `dragstart`: set the dragged item's visual state (e.g., reduced opacity). Store the dragged item index.
- On `dragover` another item: show a drop indicator line (element with `data-testid="drop-indicator"`) at the position where the item would be inserted.
- On `drop`: reorder the items array (move dragged item to drop position), call `onReorder` with the new array.
- On `dragend`: clear all drag visual states.

### Drop indicator logic

- The drop indicator appears **between** items (above or below), based on whether the cursor is in the top or bottom half of the target item.
- If dragging over the top half → indicator above the target.
- If dragging over the bottom half → indicator below the target.
- The indicator should not appear at the item's original position (no-op drop).

### Keyboard reordering

- Each item is focusable (`tabIndex={0}`).
- **Alt+ArrowUp**: move focused item up one position. Call `onReorder`.
- **Alt+ArrowDown**: move focused item down one position. Call `onReorder`.
- Focus follows the moved item to its new position.
- At boundaries (first/last), the key combo is a no-op.

### Accessibility

- The list container has `role="list"`.
- Each item has `role="listitem"`.
- Each item has `aria-label` describing its position: `"{content}, item {position} of {total}"`.
- After a keyboard reorder, announce the new position via an `aria-live="polite"` region (`data-testid="live-region"`): `"Moved {content} to position {position} of {total}"`.

---

## Tests you should write

### Rendering

- All items render in order
- Items have correct data-testid attributes
- Items have correct aria-labels with position

### Drag-and-drop

- dragstart sets visual state on dragged item
- dragover shows drop indicator
- drop reorders items and calls onReorder
- dragend clears visual state

### Keyboard reordering

- Alt+ArrowDown moves item down, calls onReorder
- Alt+ArrowUp moves item up, calls onReorder
- Boundary: Alt+ArrowUp on first item is no-op
- Boundary: Alt+ArrowDown on last item is no-op
- Focus follows moved item

### Accessibility

- aria-labels update after reorder
- Live region announces new position after keyboard reorder

---

## Follow-up ladder (do not implement unless asked)

1. Add touch support using pointer events instead of drag events.
2. Add smooth CSS transitions when items change position.
3. Support multi-select: drag multiple items at once.
