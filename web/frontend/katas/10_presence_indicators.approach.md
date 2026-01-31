# Kata 10: Presence Indicators — Approach

## What Interviewers Evaluate

- Do you throttle presence updates (don’t spam the network)?
- Can you map a cursor index → (line, column)?
- Can you render remote cursors/pointers in a simple way?

---

## iPad Sketch

```
Local editor + overlayed remote cursors:

  ┌──────────────────────────────┐
  │ hello world                  │
  │ line two here                │
  │ line three                   │
  └──────────────────────────────┘
       ▲      ▲
     you    alice

Render strategy (interview-friendly):
  - textarea for editing
  - absolutely positioned overlay on top
  - caret position computed from monospace metrics
```

Throttle timeline (cursor moves faster than we emit):
```
cursor events:  |.|.|.|.|.|.|.|.|.|.|
emit (100ms):   |.....|.....|.....|..
                     ^ emits latest value (trailing)
```

---

## First 2 Minutes: Break It Down (Before Coding)

Two subproblems: throttling + positioning.

```
local selection -> throttled emit
remote cursorIndex -> (line,col) -> (x,y) -> overlay caret
```

Concrete chunks:
1. **Data model**: `remoteUsers[]` with `cursorIndex` and `color`.
2. **Throttle helper**: trailing throttle so you emit latest cursor occasionally.
3. **Index mapping**: `cursorIndex -> line/col` based on newlines.
4. **Overlay rendering**: absolute caret + label (monospace approximation).
5. **Edge cases**: cursor beyond length, multiline, variable fonts (call out limitation).

---

## Data Model

Presence usually looks like:

- `userId`, `name`, `color`
- `cursorIndex` (or `{ line, column }`)
- maybe `selection: { start, end }`

---

## Throttling

Use a throttled callback for cursor updates:
- emit at most once per `throttleMs`
- keep the latest value (trailing edge)

---

## Rendering Remote Cursors

Simplify for interviews:
- assume monospace font
- measure `charWidth` and `lineHeight`
- compute `(line, col)` from `cursorIndex`
- absolutely position a 2px caret at `(left = padding + col * charWidth, top = padding + line * lineHeight)`

---

## Worked Example: index → (line, col)

```
text:
  "ab\ncde\nf"

indices:
   0 1 2 3 4 5 6 7
   a b \n c d e \n f

cursorIndex = 5 points at 'e'

before = "ab\ncd"
line = number of '\n' in before = 1  (0-based)
col  = chars since last '\n' = 2     (0-based)

So render caret at (line=1, col=2).
```
