# Kata 6: Virtualized List — Approach

## What Interviewers Evaluate

- Can you explain why rendering 10k DOM nodes is slow?
- Do you compute the visible window correctly from `scrollTop`?
- Do you handle off-by-one + overscan?
- Is the API clean (`itemHeight`, `height`, `renderItem`, `getKey`)?

---

## iPad Sketch

```
DOM structure (fixed-height rows):

  <div class="scroll-container" style="height=H; overflow:auto">
    <div class="spacer" style="height = N * itemHeight; position:relative">
      {only visible rows, absolutely positioned}
    </div>
  </div>

Coordinate system:

  scrollTop = pixels scrolled inside container
  row i top = i * itemHeight

Viewport (H=100px, itemHeight=20px):

  ┌──────────────────────────────┐  ← scroll container
  │ row 13 @ top=260             │
  │ row 14 @ top=280             │  ← only these rows exist in DOM
  │ row 15 @ top=300             │
  │ row 16 @ top=320             │
  │ row 17 @ top=340             │
  └──────────────────────────────┘
      spacer height = N*20
```

---

## First 2 Minutes: Break It Down (Before Coding)

```
scrollTop -> [start..end] -> render window + spacer
```

Concrete chunks:
1. **API**: `items`, `height`, `itemHeight`, `renderItem`, `overscan`, optional `getKey`.
2. **DOM layout**: scroll container + spacer + absolutely positioned rows.
3. **Window math**: compute `startIndex/endIndex` (+ overscan + clamp).
4. **Scroll updates**: update `scrollTop` (optionally throttled via rAF).
5. **Edge cases**: empty list, tiny viewport, large scrollTop.

---

## Core Math

Given:
- `itemHeight` (px, fixed)
- `height` (px, viewport height)
- `scrollTop` (px)

Compute:
- `startIndex = floor(scrollTop / itemHeight)`
- `endIndex = floor((scrollTop + height) / itemHeight)`
- Apply `overscan`:
  - `startIndex = max(0, startIndex - overscan)`
  - `endIndex = min(n - 1, endIndex + overscan)`

Render:
- A spacer with `height = n * itemHeight`
- Only items in `[startIndex, endIndex]`, positioned at `top = index * itemHeight`

---

## Worked Example (to sanity-check off-by-one)

Assume:
- `n = 100`
- `itemHeight = 20`
- `height = 100`
- `overscan = 2`
- `scrollTop = 260`

Compute:
- `rawStart = floor(260 / 20) = 13`
- `rawEnd = floor((260 + 100) / 20) = floor(360 / 20) = 18`
- `startIndex = max(0, 13 - 2) = 11`
- `endIndex = min(99, 18 + 2) = 20`

So you render rows `[11..20]` (10 rows) even though only ~6 are visible; the extra are the overscan buffer.

---

## State / Transitions

```
onScroll (many times per second)
  ↓ (throttle via rAF to 1 update/frame)
setScrollTop(nextScrollTop)
  ↓
recompute window [startIndex..endIndex]
  ↓
render subset (absolute positioned)
```

## Edge Cases to Mention

- Empty list
- Very small/large `itemHeight`
- Stable keys (don’t key by index if the list can reorder)
- Throttle scroll updates (e.g. `requestAnimationFrame`) to avoid re-rendering on every scroll event
