# Kata 11: Tooltip / Popover Positioning — Approach

## What Interviewers Evaluate

- Can you compute position from `getBoundingClientRect()`?
- Do you handle viewport overflow (flip + clamp)?
- Do you re-position on scroll/resize?
- Do you handle outside click / escape to close?

---

## iPad Sketch

```
Viewport
┌──────────────────────────────────────┐
│                                      │
│  [anchor button]                     │
│        │                             │
│        ▼ (placement=bottom)          │
│     ┌───────────────┐                │
│     │   popover     │                │
│     └───────────────┘                │
│                                      │
└──────────────────────────────────────┘

Key inputs:
  anchorRect = anchor.getBoundingClientRect()
  popoverRect = popover.getBoundingClientRect()

Compute candidate (bottom):
  top  = anchorRect.bottom + offset
  left = anchorRect.left + (anchorRect.width - popoverRect.width)/2

If popover would overflow bottom, flip to top:
  top = anchorRect.top - popoverRect.height - offset

Always clamp into viewport:
  top  = clamp(top, pad, vh - pad - popoverHeight)
  left = clamp(left, pad, vw - pad - popoverWidth)
```

---

## First 2 Minutes: Break It Down (Before Coding)

Treat it as “measure → compute → keep updated”:

```
anchorRect + popoverRect -> position -> (flip?) -> clamp -> setStyle
```

Concrete chunks:
1. **Refs**: `anchorRef`, `popoverRef`; open/close state.
2. **Compute**: function that returns `{ top, left }` for a placement.
3. **Overflow handling**: flip if overflow, then clamp to viewport padding.
4. **Recompute triggers**: on open, on scroll (capture), on resize.
5. **Dismissal**: outside click + Escape.

---

## Typical Strategy

1. Render popover (possibly offscreen) so it has a measurable size.
2. Measure:
   - `anchorRect`
   - `popoverRect`
3. Compute initial `top/left` for your preferred placement.
4. If it overflows viewport:
   - flip (bottom ↔ top, left ↔ right)
   - clamp to `[padding, viewport - padding]`
5. Subscribe to `resize` and `scroll` to recompute.

---

## Worked Example: Flip + Clamp

Assume:
- viewport height `vh = 800`, padding `pad = 8`
- `anchorRect.bottom = 780`
- `popoverHeight = 120`, `offset = 8`

Bottom placement would be:
```
top = 780 + 8 = 788
top + popoverHeight = 908  (overflows)
```

Flip to top:
```
top = anchorRect.top - popoverHeight - offset
```

If that still overflows, clamp:
```
top = clamp(top, 8, 800 - 8 - 120 = 672)
```
