# Kata 4 — Inline Diff Viewer

## Context

You're building a code review component for a developer tool (think: Cursor's inline edit suggestions, GitHub's PR diff view). Given two versions of text, render a unified diff showing additions and deletions, with the ability to accept or reject individual changes.

---

## Goal

Implement a `DiffViewer` React component that:

- Computes a line-level diff between two text strings
- Renders additions (green), deletions (red), and unchanged lines
- Allows accepting or rejecting individual change hunks
- Produces a final merged result based on user decisions

---

## API

```tsx
type DiffLine = {
  type: "add" | "remove" | "unchanged";
  content: string;
  lineNumber: { old?: number; new?: number };
};

type Hunk = {
  id: string;
  lines: DiffLine[];
};

type DiffViewerProps = {
  original: string;
  modified: string;
  /** Called whenever the user accepts or rejects a hunk. Receives the full resolved text. */
  onResolve?: (resolvedText: string) => void;
};

export function computeDiff(original: string, modified: string): Hunk[];

export function DiffViewer(props: DiffViewerProps): JSX.Element {
  throw new Error("TODO");
}
```

---

## Diff algorithm

Use a simple LCS (Longest Common Subsequence) based diff at the line level. You don't need Myers' algorithm — a basic DP approach is fine for interview scope.

### Steps

1. Split both texts by `\n`.
2. Compute LCS of the two line arrays.
3. Walk both arrays and the LCS to produce `DiffLine[]`:
   - Lines in both and in LCS → `unchanged`
   - Lines only in original → `remove`
   - Lines only in modified → `add`
4. Group consecutive non-unchanged lines into hunks. Include 1 unchanged line of context above and below each hunk (if available).
5. Unchanged-only regions between hunks become their own hunk (all unchanged lines).

Each hunk gets a unique `id` (use index or `crypto.randomUUID()`).

---

## Behavior

### Rendering

- Container has `data-testid="diff-viewer"`.
- Each line renders with a `data-diff-type` attribute: `"add"`, `"remove"`, or `"unchanged"`.
- Added lines have a green background. Removed lines have a red background. Unchanged lines have no background.
- Line numbers displayed in gutters:
  - Removed lines show old line number only.
  - Added lines show new line number only.
  - Unchanged lines show both.

### Hunk actions

- Each hunk with changes (contains add or remove lines) shows two buttons:
  - Accept (`data-testid="accept-{hunkId}"`) — keeps the "modified" version of the hunk.
  - Reject (`data-testid="reject-{hunkId}"`) — keeps the "original" version of the hunk.
- After a decision, the hunk re-renders as all-unchanged lines (the chosen version) and the buttons disappear.
- Unchanged-only hunks have no buttons.

### Resolution

- After each accept/reject, compute the full resolved text by walking all hunks:
  - Accepted hunks → use `add` lines (and drop `remove` lines).
  - Rejected hunks → use `remove` lines (and drop `add` lines).
  - Unchanged hunks → use unchanged lines.
  - Unresolved hunks → use `add` lines (default to modified).
- Call `onResolve(resolvedText)` after each decision.

---

## Tests you should write

### computeDiff

- Identical strings → all unchanged, single hunk
- Completely different strings → one hunk of removes + adds
- Single line added in the middle → unchanged/add/unchanged hunks
- Single line removed → unchanged/remove/unchanged hunks
- Empty original, non-empty modified → all adds
- Empty modified, non-empty original → all removes

### DiffViewer rendering

- Correct data-diff-type attributes on lines
- Line numbers are correct for add/remove/unchanged
- Hunk buttons render only for hunks with changes

### Hunk resolution

- Accepting a hunk updates display to show modified version
- Rejecting a hunk updates display to show original version
- onResolve called with correct merged text after each decision
- Accept all → resolvedText equals modified
- Reject all → resolvedText equals original

---

## Follow-up ladder (do not implement unless asked)

1. Add word-level diff within changed lines (highlight specific changed words).
2. Add "Accept All" / "Reject All" buttons.
3. Add side-by-side view mode toggle.
