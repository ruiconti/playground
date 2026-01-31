# Kata 7: Expandable Tree (Lazy + Keyboard) — Approach

## What Interviewers Evaluate

- Can you model tree state cleanly (expanded/selected/loading)?
- Can you flatten visible nodes for rendering + keyboard navigation?
- Do you handle lazy loading without race conditions?
- Do you keep the API simple (`roots`, `loadChildren`, `onSelect`)?

---

## iPad Sketch

```
Tree UI (▸ collapsed, ▾ expanded):

  ▾ src/                 (id=src)        ← expanded
      ▸ components/       (id=cmp)        ← collapsed
      ▾ utils/            (id=utils)      ← expanded, loading
          (Loading…)
  ▸ package.json          (id=pkg)

State (minimal):
  expanded   = { "src", "utils" }
  loading    = { "utils" }
  selectedId = "pkg"
  activeId   = "utils"  (keyboard focus / roving tabIndex)
  childrenById["src"]   = [...]
  childrenById["utils"] = undefined (not loaded yet)
```

Keyboard:
- ArrowUp/ArrowDown moves `activeId` within the flattened visible list
- ArrowRight: expand (and load), or move to first child if already expanded
- ArrowLeft: collapse, or move to parent if already collapsed

---

## First 2 Minutes: Break It Down (Before Coding)

Treat it as “tree data → visible list → keyboard moves inside list”:

```
expanded + childrenById + roots -> flatten() -> render -> keyboard/toggle
```

Concrete chunks:
1. **State**: `expanded`, `activeId`, `selectedId`, `loading`, `childrenById`.
2. **Flattening**: pure `flattenTree()` returns visible nodes with `depth` + `parentId`.
3. **Toggle expand**: update `expanded`; if expanding and lazy, kick off `loadChildren`.
4. **Stale guard**: per-node `requestId` so late responses don’t overwrite newer loads.
5. **Keyboard nav**: ArrowUp/Down, ArrowLeft/Right using indices in flattened list.

---

## State Model

Minimal state usually looks like:

- `expanded: Set<id>`
- `selectedId: id | null`
- `activeId: id | null` (roving focus / keyboard)
- `loading: Set<id>`
- `childrenById: Record<id, TreeNode[]>` (for lazy-loaded children)

---

## Flatten Visible Nodes

DFS over `roots`:
- Always include the node
- If `expanded` and it has children, include its children at `depth + 1`

This gives `visible: Array<{ id, node, depth, parentId }>` which powers:
- rendering indentation
- ArrowUp/ArrowDown
- ArrowLeft (collapse or go to parent)
- ArrowRight (expand or go to first child)

---

## Worked Example: Flattening + Navigation

Given:
```
roots:
  src (children: [components, utils])
  package.json

expanded = { "src" }
```

Flattened visible list (with depth):
```
0: src           depth=0
1: components    depth=1
2: utils         depth=1
3: package.json  depth=0
```

If `activeId = components` and user presses:
- ArrowDown → `activeId = utils`
- ArrowLeft → since `components` is not expanded, go to parent `src`
- ArrowRight on `src` → already expanded, move to first child `components`

---

## Lazy Load State / Transitions

```
toggleExpand(nodeId)
  if expanding:
    if children missing and node.hasChildren:
      loading.add(nodeId)
      requestIdByNode[nodeId]++
      loadChildren(nodeId)
        ↓
        if requestId matches (not stale):
          childrenById[nodeId] = children
        loading.delete(nodeId)
  expanded.toggle(nodeId)
```

## Edge Cases

- Expanding a node triggers `loadChildren`; show a spinner; ignore stale async results.
- Collapse while loading: safe; loading can finish but node stays collapsed.
- Empty tree
