# Kata 8: Multi-Cursor / Multi-Selection — Approach

## What Interviewers Evaluate

- Can you represent multiple selections as ranges (`start`, `end`)?
- Can you normalize/merge overlaps deterministically?
- Do you handle cursors (zero-length selections) as a special case of ranges?
- Can you visualize selections without a full editor implementation?

---

## iPad Sketch

```
Text with indices:

  text = "hello world"
          01234567890

Ranges are half-open: [start, end)
  [0,5)  -> "hello"
  [6,11) -> "world"
  [5,5)  -> cursor between 'o' and ' '

Render idea (simple):
  - selected ranges highlighted
  - cursors shown as a thin caret
```

---

## First 2 Minutes: Break It Down (Before Coding)

This problem is mostly data normalization:

```
raw ranges -> normalize (clamp/swap) -> sort -> merge -> render
```

Concrete chunks:
1. **Range type**: decide `[start, end)` semantics; cursor is `start===end`.
2. **Normalize**: clamp into `[0..len]` and swap if reversed.
3. **Merge**: sort by start and merge overlaps/adjacent.
4. **Render**: highlight merged ranges + draw caret for zero-length ranges.
5. **Interactions (optional)**: add/remove range from textarea selection.

---

## Data Model

Represent each selection as a half-open range: `[start, end)`:

- Cursor: `start === end`
- Selection: `start < end`

Maintain:
- `ranges: Array<{ id, start, end }>`

Normalize on every change:
- clamp to `[0, text.length]`
- swap if `start > end`
- sort by `start`
- merge overlaps/adjacent ranges

---

## Merging Overlaps

Sort by `start`, then:
- keep a `current` range
- if `next.start <= current.end`, merge: `current.end = max(current.end, next.end)`
- else, push `current` and start new

---

## Worked Example: Normalization + Merge

Given:
```
textLength = 12
ranges (raw):
  A: [8, 3)   (backwards selection)
  B: [-2, 2)  (out of bounds)
  C: [5, 9)
  D: [9, 10)  (touching boundary)
```

Normalize (clamp + swap):
```
  A -> [3, 8)
  B -> [0, 2)
  C -> [5, 9)
  D -> [9, 10)
```

Sort:
```
  [0,2), [3,8), [5,9), [9,10)
```

Merge (note adjacency: `next.start <= current.end` merges touching ranges):
```
  [0,2) stays
  [3,8) merges with [5,9) -> [3,9)
  [3,9) merges with [9,10) -> [3,10)
Result: [0,2), [3,10)
```
