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

Each stage shows complete working code. New/changed lines marked with `// ← NEW`.

---

### Stage 1: Types and LCS algorithm

Pure function, no React. This is the algorithmic core.

```tsx
// Types
type DiffLine = {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber: { old?: number; new?: number };
};

type Hunk = {
  id: string;
  lines: DiffLine[];
};

type HunkStatus = 'pending' | 'accepted' | 'rejected';

// LCS: Longest Common Subsequence via dynamic programming
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // Build DP table: dp[i][j] = length of LCS of a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the actual LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}
```

**This is just the algorithm.** No React yet, no component.

---

### Stage 2: Generate diff lines from LCS

Walk both arrays, classify each line as add/remove/unchanged.

```tsx
type DiffLine = {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber: { old?: number; new?: number };
};

type Hunk = {
  id: string;
  lines: DiffLine[];
};

type HunkStatus = 'pending' | 'accepted' | 'rejected';

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs: string[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

// ← NEW: Generate diff from LCS
function generateDiffLines(original: string, modified: string): DiffLine[] {
  const oldLines = original.split('\n');
  const newLines = modified.split('\n');
  const lcs = computeLCS(oldLines, newLines);

  const diffLines: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];
    const lcsLine = lcs[lcsIdx];

    if (oldIdx < oldLines.length && oldLine === lcsLine && newLine === lcsLine) {
      // Line in both and in LCS → unchanged
      diffLines.push({
        type: 'unchanged',
        content: oldLine,
        lineNumber: { old: oldLineNum++, new: newLineNum++ },
      });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    } else if (oldIdx < oldLines.length && oldLine !== lcsLine) {
      // Line only in original → removed
      diffLines.push({
        type: 'remove',
        content: oldLine,
        lineNumber: { old: oldLineNum++ },
      });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      // Line only in modified → added
      diffLines.push({
        type: 'add',
        content: newLine,
        lineNumber: { new: newLineNum++ },
      });
      newIdx++;
    }
  }

  return diffLines;
}
```

**Problem with Stage 2**: All lines are in one flat array. No hunks, no context grouping.

---

### Stage 3: Group into hunks with context

Split diff into hunks, with context lines around changes.

```tsx
type DiffLine = {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber: { old?: number; new?: number };
};

type Hunk = {
  id: string;
  lines: DiffLine[];
};

type HunkStatus = 'pending' | 'accepted' | 'rejected';

function computeLCS(a: string[], b: string[]): string[] {
  /* ... same as before ... */
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { lcs.unshift(a[i - 1]); i--; j--; }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }
  return lcs;
}

function generateDiffLines(original: string, modified: string): DiffLine[] {
  /* ... same as before ... */
  const oldLines = original.split('\n');
  const newLines = modified.split('\n');
  const lcs = computeLCS(oldLines, newLines);
  const diffLines: DiffLine[] = [];
  let oldIdx = 0, newIdx = 0, lcsIdx = 0, oldLineNum = 1, newLineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx], newLine = newLines[newIdx], lcsLine = lcs[lcsIdx];
    if (oldIdx < oldLines.length && oldLine === lcsLine && newLine === lcsLine) {
      diffLines.push({ type: 'unchanged', content: oldLine, lineNumber: { old: oldLineNum++, new: newLineNum++ } });
      oldIdx++; newIdx++; lcsIdx++;
    } else if (oldIdx < oldLines.length && oldLine !== lcsLine) {
      diffLines.push({ type: 'remove', content: oldLine, lineNumber: { old: oldLineNum++ } });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      diffLines.push({ type: 'add', content: newLine, lineNumber: { new: newLineNum++ } });
      newIdx++;
    }
  }
  return diffLines;
}

// ← NEW: Group lines into hunks
export function computeDiff(original: string, modified: string): Hunk[] {
  const diffLines = generateDiffLines(original, modified);

  if (diffLines.length === 0) return [];

  // Find indices of changed lines
  const changeIndices: number[] = [];
  diffLines.forEach((line, idx) => {
    if (line.type !== 'unchanged') changeIndices.push(idx);
  });

  // No changes → single unchanged hunk
  if (changeIndices.length === 0) {
    return [{ id: 'hunk-0', lines: diffLines }];
  }

  // Expand each change by context, merge overlapping regions
  const contextLines = 1;
  const regions: Array<{ start: number; end: number }> = [];
  let currentRegion: { start: number; end: number } | null = null;

  for (const idx of changeIndices) {
    const start = Math.max(0, idx - contextLines);
    const end = Math.min(diffLines.length - 1, idx + contextLines);

    if (!currentRegion) {
      currentRegion = { start, end };
    } else if (start <= currentRegion.end + 1) {
      // Overlapping or adjacent → merge
      currentRegion.end = Math.max(currentRegion.end, end);
    } else {
      regions.push(currentRegion);
      currentRegion = { start, end };
    }
  }
  if (currentRegion) regions.push(currentRegion);

  // Build hunks from regions
  const hunks: Hunk[] = [];
  let hunkId = 0;
  let lastHunkEnd = -1;

  for (const region of regions) {
    // Gap before this region → unchanged hunk
    if (lastHunkEnd + 1 < region.start) {
      hunks.push({
        id: `hunk-${hunkId++}`,
        lines: diffLines.slice(lastHunkEnd + 1, region.start),
      });
    }

    // Change hunk
    hunks.push({
      id: `hunk-${hunkId++}`,
      lines: diffLines.slice(region.start, region.end + 1),
    });

    lastHunkEnd = region.end;
  }

  // Trailing unchanged hunk
  if (lastHunkEnd < diffLines.length - 1) {
    hunks.push({
      id: `hunk-${hunkId++}`,
      lines: diffLines.slice(lastHunkEnd + 1),
    });
  }

  return hunks;
}
```

**Now we have pure functions that compute hunks.** Time to build the React component.

---

### Stage 4: Basic React component (display only)

Render hunks with accept/reject buttons, but no resolution logic yet.

```tsx
import React, { useState, useMemo } from 'react';

/* ... types and pure functions from Stage 3 ... */

type DiffViewerProps = {
  original: string;
  modified: string;
  onResolve?: (resolvedText: string) => void;
};

export function DiffViewer({
  original,
  modified,
  onResolve,
}: DiffViewerProps): React.ReactElement {
  // Memoize expensive diff computation
  const hunks = useMemo(
    () => computeDiff(original, modified),
    [original, modified]
  );

  const [hunkStatuses, setHunkStatuses] = useState<Map<string, HunkStatus>>(
    () => new Map()
  );

  const hunkHasChanges = (hunk: Hunk) =>
    hunk.lines.some((l) => l.type !== 'unchanged');

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
      {hunks.map((hunk) => {
        const status = hunkStatuses.get(hunk.id) ?? 'pending';
        const hasChanges = hunkHasChanges(hunk);

        return (
          <div key={hunk.id} style={{ borderBottom: '1px solid #eee' }}>
            {hunk.lines.map((line, lineIdx) => {
              const bgColor =
                line.type === 'add'
                  ? '#e6ffed'
                  : line.type === 'remove'
                    ? '#ffeef0'
                    : 'transparent';

              const prefix =
                line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

              return (
                <div
                  key={lineIdx}
                  style={{ display: 'flex', backgroundColor: bgColor }}
                >
                  <span style={{ width: '40px', color: '#999' }}>
                    {line.lineNumber.old ?? ''}
                  </span>
                  <span style={{ width: '40px', color: '#999' }}>
                    {line.lineNumber.new ?? ''}
                  </span>
                  <span style={{ width: '20px' }}>{prefix}</span>
                  <span style={{ flex: 1 }}>{line.content}</span>
                </div>
              );
            })}

            {/* Accept/Reject buttons for change hunks */}
            {hasChanges && status === 'pending' && (
              <div style={{ padding: '8px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setHunkStatuses((prev) =>
                      new Map(prev).set(hunk.id, 'accepted')
                    );
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={() => {
                    setHunkStatuses((prev) =>
                      new Map(prev).set(hunk.id, 'rejected')
                    );
                  }}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Problem with Stage 4**: Clicking accept/reject updates status but doesn't call `onResolve`. Also, resolved hunks still show diff colors.

---

### Stage 5: Resolution logic + visual updates (Final)

Compute resolved text when status changes. Update visuals for resolved hunks.

```tsx
import React, { useState, useMemo, useCallback } from 'react';

type DiffLine = {
  type: 'add' | 'remove' | 'unchanged';
  content: string;
  lineNumber: { old?: number; new?: number };
};

type Hunk = { id: string; lines: DiffLine[] };
type HunkStatus = 'pending' | 'accepted' | 'rejected';

/* computeLCS, generateDiffLines, computeDiff - same as Stage 3 */

type DiffViewerProps = {
  original: string;
  modified: string;
  onResolve?: (resolvedText: string) => void;
};

export function DiffViewer({
  original,
  modified,
  onResolve,
}: DiffViewerProps): React.ReactElement {
  const hunks = useMemo(
    () => computeDiff(original, modified),
    [original, modified]
  );

  const [hunkStatuses, setHunkStatuses] = useState<Map<string, HunkStatus>>(
    () => new Map()
  );

  // ← NEW: Compute resolved text from hunks + statuses
  const computeResolvedText = useCallback(
    (statuses: Map<string, HunkStatus>) => {
      const lines: string[] = [];

      for (const hunk of hunks) {
        const status = statuses.get(hunk.id) ?? 'pending';

        for (const line of hunk.lines) {
          if (line.type === 'unchanged') {
            lines.push(line.content);
          } else if (line.type === 'add') {
            // Include adds for accepted or pending (default to modified)
            if (status === 'accepted' || status === 'pending') {
              lines.push(line.content);
            }
          } else if (line.type === 'remove') {
            // Include removes only for rejected
            if (status === 'rejected') {
              lines.push(line.content);
            }
          }
        }
      }

      return lines.join('\n');
    },
    [hunks]
  );

  // ← NEW: Handlers that update state AND call onResolve
  const handleAccept = (hunkId: string) => {
    const next = new Map(hunkStatuses).set(hunkId, 'accepted');
    setHunkStatuses(next);
    onResolve?.(computeResolvedText(next));  // Side effect OUTSIDE setState
  };

  const handleReject = (hunkId: string) => {
    const next = new Map(hunkStatuses).set(hunkId, 'rejected');
    setHunkStatuses(next);
    onResolve?.(computeResolvedText(next));
  };

  const hunkHasChanges = (hunk: Hunk) =>
    hunk.lines.some((l) => l.type !== 'unchanged');

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
      {hunks.map((hunk) => {
        const status = hunkStatuses.get(hunk.id) ?? 'pending';
        const hasChanges = hunkHasChanges(hunk);
        const isResolved = status !== 'pending';         // ← NEW

        return (
          <div key={hunk.id} style={{ borderBottom: '1px solid #eee' }}>
            {hunk.lines.map((line, lineIdx) => {
              // ← NEW: When resolved, hide irrelevant lines
              if (isResolved && hasChanges) {
                if (status === 'accepted' && line.type === 'remove') {
                  return null;  // Hide removed lines when accepted
                }
                if (status === 'rejected' && line.type === 'add') {
                  return null;  // Hide added lines when rejected
                }
              }

              // ← NEW: After resolution, show remaining lines as unchanged
              const effectiveType = isResolved && hasChanges ? 'unchanged' : line.type;

              const bgColor =
                effectiveType === 'add'
                  ? '#e6ffed'
                  : effectiveType === 'remove'
                    ? '#ffeef0'
                    : 'transparent';

              const prefix =
                line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

              return (
                <div
                  key={lineIdx}
                  style={{ display: 'flex', backgroundColor: bgColor }}
                >
                  <span style={{ width: '40px', color: '#999' }}>
                    {line.lineNumber.old ?? ''}
                  </span>
                  <span style={{ width: '40px', color: '#999' }}>
                    {line.lineNumber.new ?? ''}
                  </span>
                  <span style={{ width: '20px' }}>{prefix}</span>
                  <span style={{ flex: 1 }}>{line.content}</span>
                </div>
              );
            })}

            {/* ← CHANGED: Only show buttons for pending change hunks */}
            {hasChanges && !isResolved && (
              <div style={{ padding: '8px', display: 'flex', gap: '8px' }}>
                <button onClick={() => handleAccept(hunk.id)}>Accept</button>
                <button onClick={() => handleReject(hunk.id)}>Reject</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**This is the complete component.** Each stage addressed a specific gap:
1. Types + LCS → algorithm only, no React
2. Generate diff lines → flat array, no grouping
3. Hunk grouping → structured data, ready for UI
4. Basic component → displays but doesn't resolve
5. Resolution logic → production-ready

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
