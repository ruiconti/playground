# Kata 4: Diff Viewer — Approach

## What Interviewers Actually Evaluate

| Signal | What they're looking for |
|--------|--------------------------|
| **Algorithm knowledge** | Can you explain LCS and implement basic DP without reference? |
| **Separation of concerns** | Do you keep the diff algorithm pure (no React), separate from the component? |
| **Derived state** | Do you understand that resolved text is computed from hunks + statuses, not stored separately? |
| **Data modeling** | Is your Hunk/DiffLine structure minimal and correct? |

---

## iPad Sketch

```
LCS DP Table (for lines ["a","b","c"] vs ["a","d","c"]):

        ""   a   d   c
    "" [ 0,  0,  0,  0]
     a [ 0,  1,  1,  1]
     b [ 0,  1,  1,  1]
     c [ 0,  1,  1,  2]

LCS = ["a", "c"]

Diff output:
  a  →  unchanged (in LCS)
  b  →  remove (only in original)
  d  →  add (only in modified)
  c  →  unchanged (in LCS)
```

```
Hunk structure:
{
  id: "hunk-1",
  lines: [
    { type: "unchanged", content: "a", lineNumber: { old: 1, new: 1 } },
    { type: "remove",    content: "b", lineNumber: { old: 2 } },
    { type: "add",       content: "d", lineNumber: { new: 2 } },
    { type: "unchanged", content: "c", lineNumber: { old: 3, new: 3 } },
  ]
}

Statuses (separate state):
  Map<hunkId, "pending" | "accepted" | "rejected">

Resolution logic:
  accepted → keep adds, drop removes
  rejected → keep removes, drop adds
  pending  → keep adds (default to modified)
```

---

## Questions to Ask Interviewer

1. "How many lines of context around each change? Is 1 line sufficient?"
   - (Usually: 1-3 lines is fine for interview scope)

2. "Should unresolved hunks default to original or modified?"
   - (Usually: modified — that's the proposed change)

3. "Should I implement Myers diff or is basic LCS fine?"
   - (Usually: basic LCS is fine — Myers is overkill for interview)

---

## Implementation Order

### 1. LCS algorithm (pure function, no React)

```tsx
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length, n = b.length;

  // Build DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i-1] === b[j-1]) {
        dp[i][j] = dp[i-1][j-1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i-1] === b[j-1]) {
      lcs.unshift(a[i-1]);
      i--; j--;
    } else if (dp[i-1][j] > dp[i][j-1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}
```

### 2. Generate diff lines from LCS

Walk both arrays simultaneously, comparing with LCS:

```tsx
function generateDiffLines(original: string, modified: string): DiffLine[] {
  const oldLines = original.split('\n');
  const newLines = modified.split('\n');
  const lcs = computeLCS(oldLines, newLines);

  const result: DiffLine[] = [];
  let oldIdx = 0, newIdx = 0, lcsIdx = 0;
  let oldLineNum = 1, newLineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];
    const lcsLine = lcs[lcsIdx];

    if (oldLine === lcsLine && newLine === lcsLine) {
      // Unchanged
      result.push({
        type: 'unchanged',
        content: oldLine,
        lineNumber: { old: oldLineNum++, new: newLineNum++ }
      });
      oldIdx++; newIdx++; lcsIdx++;
    } else if (oldIdx < oldLines.length && oldLine !== lcsLine) {
      // Remove
      result.push({
        type: 'remove',
        content: oldLine,
        lineNumber: { old: oldLineNum++ }
      });
      oldIdx++;
    } else {
      // Add
      result.push({
        type: 'add',
        content: newLine,
        lineNumber: { new: newLineNum++ }
      });
      newIdx++;
    }
  }

  return result;
}
```

### 3. Group into hunks with context

```tsx
function groupIntoHunks(lines: DiffLine[], contextLines = 1): Hunk[] {
  // Find change indices
  const changeIndices = lines
    .map((line, i) => line.type !== 'unchanged' ? i : -1)
    .filter(i => i !== -1);

  if (changeIndices.length === 0) {
    return [{ id: 'hunk-0', lines }];
  }

  // Expand each change by context, merge overlapping
  // ... (see solution for full implementation)
}
```

### 4. Component with status tracking

```tsx
function DiffViewer({ original, modified, onResolve }) {
  const hunks = useMemo(
    () => computeDiff(original, modified),
    [original, modified]
  );

  const [statuses, setStatuses] = useState<Map<string, HunkStatus>>(
    () => new Map()
  );

  // Derive resolved text from hunks + statuses
  const computeResolved = (statuses: Map<string, HunkStatus>) => {
    return hunks.flatMap(hunk => {
      const status = statuses.get(hunk.id) ?? 'pending';
      return hunk.lines.filter(line => {
        if (line.type === 'unchanged') return true;
        if (line.type === 'add') return status !== 'rejected';
        if (line.type === 'remove') return status === 'rejected';
      });
    }).map(l => l.content).join('\n');
  };

  const handleAccept = (hunkId: string) => {
    setStatuses(prev => {
      const next = new Map(prev).set(hunkId, 'accepted');
      onResolve?.(computeResolved(next));
      return next;
    });
  };
}
```

---

## Red Flags That Sink Candidates

| Mistake | Why it's a red flag |
|---------|---------------------|
| Storing resolved text in state | It's derived from hunks + statuses. Duplicate state leads to sync bugs. |
| Mutating hunks array | Breaks React's change detection. Shows poor immutability habits. |
| Recomputing diff on every status change | Diff is expensive and only depends on original/modified. Should be memoized. |
| Off-by-one errors in line numbers | Classic algorithm bug. Shows lack of careful tracing. |
| Not handling empty string edge case | `"".split('\n')` returns `[""]`, not `[]`. |

---

## Line Number Tracking

This trips people up. You need TWO counters:

```
original:  a  b  c       oldLineNum: 1, 2, 3
modified:  a  d  c       newLineNum: 1, 2, 3

Diff output:
  unchanged "a"  → old: 1, new: 1   (both increment)
  remove "b"     → old: 2           (only old increments)
  add "d"        → new: 2           (only new increments)
  unchanged "c"  → old: 3, new: 3   (both increment)
```

---

## Production Concerns (Follow-up Discussion)

1. **Word-level diff**: Highlight specific changed words within lines (like GitHub)
2. **Syntax highlighting**: Integrate with a code highlighter
3. **Large files**: Virtualize the list, collapse unchanged regions
4. **Side-by-side view**: Alternative layout option
5. **Conflict resolution**: Three-way merge for git conflicts
