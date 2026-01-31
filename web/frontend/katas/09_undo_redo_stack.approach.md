# Kata 9: Undo / Redo Stack — Approach

## What Interviewers Evaluate

- Do you understand branching? (Editing after undo clears redo.)
- Do you avoid storing redundant history entries?
- Is your API ergonomic (hook or small state machine)?

---

## iPad Sketch

```
Classic 3-stack model:

  past      present        future
  [..]   [  value  ]   [ .. .. ]

undo():
  past.pop() -> present
  old present -> future.unshift()

redo():
  future.shift() -> present
  old present -> past.push()

set(next):
  past.push(present)
  present = next
  future = []   (branching)
```

State machine intuition:
```
         set()
   ┌──────────────────┐
   ▼                  │
[normal] -- undo --> [undone]
   ▲                  │
   └------ redo ------┘
```

---

## First 2 Minutes: Break It Down (Before Coding)

It’s a pure state transition problem:

```
past + present + future  --(set/undo/redo)-->  next state
```

Concrete chunks:
1. **State shape**: `past`, `present`, `future`.
2. **Actions**: implement `set`, `undo`, `redo`, `reset`.
3. **Branching rule**: any `set` clears `future`.
4. **Quality**: optional `maxSize` and `isEqual` to avoid noisy history.
5. **Demo**: wire to an input + buttons.

---

## Classic State Shape

- `past: T[]`
- `present: T`
- `future: T[]`

Transitions:

- `set(next)`: push `present` to `past`, set `present = next`, clear `future`
- `undo()`: move last of `past` to `present`, push old `present` to `future`
- `redo()`: move first of `future` to `present`, push old `present` to `past`

---

## Edge Cases

- Limit history size
- Don’t push identical states (optional `isEqual`)
- For text inputs: consider “commit” on debounce / blur to avoid 1 entry per keystroke

---

## Worked Example (shows branching)

Start:
```
past   = []
present= "A"
future = []
```

`set("B")`:
```
past   = ["A"]
present= "B"
future = []
```

`set("C")`:
```
past   = ["A","B"]
present= "C"
future = []
```

`undo()`:
```
past   = ["A"]
present= "B"
future = ["C"]
```

Now branch with `set("X")` (future cleared):
```
past   = ["A","B"]
present= "X"
future = []
```
