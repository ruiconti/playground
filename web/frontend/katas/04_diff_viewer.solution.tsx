import React, { useState, useMemo, useCallback } from "react";

type DiffLine = {
  type: "add" | "remove" | "unchanged";
  content: string;
  lineNumber: { old?: number; new?: number };
};

type Hunk = {
  id: string;
  lines: DiffLine[];
};

type HunkStatus = "pending" | "accepted" | "rejected";

type DiffViewerProps = {
  original: string;
  modified: string;
  /** Called whenever the user accepts or rejects a hunk. Receives the full resolved text. */
  onResolve?: (resolvedText: string) => void;
};

// --- LCS Algorithm ---

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // Build DP table
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

  // Backtrack to find LCS
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

// --- Diff Generation ---

function generateDiffLines(original: string, modified: string): DiffLine[] {
  const oldLines = original.split("\n");
  const newLines = modified.split("\n");
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
      // Line in both and in LCS - unchanged
      diffLines.push({
        type: "unchanged",
        content: oldLine,
        lineNumber: { old: oldLineNum++, new: newLineNum++ },
      });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    } else if (oldIdx < oldLines.length && oldLine !== lcsLine) {
      // Line only in original - removed
      diffLines.push({
        type: "remove",
        content: oldLine,
        lineNumber: { old: oldLineNum++ },
      });
      oldIdx++;
    } else if (newIdx < newLines.length && newLine !== lcsLine) {
      // Line only in modified - added
      diffLines.push({
        type: "add",
        content: newLine,
        lineNumber: { new: newLineNum++ },
      });
      newIdx++;
    } else if (oldIdx < oldLines.length) {
      // Remaining old lines
      diffLines.push({
        type: "remove",
        content: oldLine,
        lineNumber: { old: oldLineNum++ },
      });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      // Remaining new lines
      diffLines.push({
        type: "add",
        content: newLine,
        lineNumber: { new: newLineNum++ },
      });
      newIdx++;
    }
  }

  return diffLines;
}

// --- Hunk Grouping ---

export function computeDiff(original: string, modified: string): Hunk[] {
  const diffLines = generateDiffLines(original, modified);

  if (diffLines.length === 0) {
    return [];
  }

  // Find indices of changed lines
  const changeIndices: number[] = [];
  diffLines.forEach((line, idx) => {
    if (line.type !== "unchanged") {
      changeIndices.push(idx);
    }
  });

  // If no changes, return single unchanged hunk
  if (changeIndices.length === 0) {
    return [
      {
        id: "hunk-0",
        lines: diffLines,
      },
    ];
  }

  // Group changes with context
  const contextLines = 1;
  const hunks: Hunk[] = [];
  let hunkId = 0;
  let lastHunkEnd = -1;

  // Merge overlapping change regions
  const regions: Array<{ start: number; end: number }> = [];
  let currentRegion: { start: number; end: number } | null = null;

  for (const idx of changeIndices) {
    const start = Math.max(0, idx - contextLines);
    const end = Math.min(diffLines.length - 1, idx + contextLines);

    if (!currentRegion) {
      currentRegion = { start, end };
    } else if (start <= currentRegion.end + 1) {
      // Overlapping or adjacent, merge
      currentRegion.end = Math.max(currentRegion.end, end);
    } else {
      // Non-overlapping, save current and start new
      regions.push(currentRegion);
      currentRegion = { start, end };
    }
  }
  if (currentRegion) {
    regions.push(currentRegion);
  }

  // Build hunks from regions
  for (const region of regions) {
    // Add unchanged hunk before this region if there's a gap
    if (lastHunkEnd + 1 < region.start) {
      hunks.push({
        id: `hunk-${hunkId++}`,
        lines: diffLines.slice(lastHunkEnd + 1, region.start),
      });
    }

    // Add change hunk
    hunks.push({
      id: `hunk-${hunkId++}`,
      lines: diffLines.slice(region.start, region.end + 1),
    });

    lastHunkEnd = region.end;
  }

  // Add trailing unchanged hunk if any
  if (lastHunkEnd < diffLines.length - 1) {
    hunks.push({
      id: `hunk-${hunkId++}`,
      lines: diffLines.slice(lastHunkEnd + 1),
    });
  }

  return hunks;
}

// --- Component ---

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

  const computeResolvedText = useCallback(
    (statuses: Map<string, HunkStatus>) => {
      const lines: string[] = [];

      for (const hunk of hunks) {
        const status = statuses.get(hunk.id) ?? "pending";

        for (const line of hunk.lines) {
          if (line.type === "unchanged") {
            lines.push(line.content);
          } else if (line.type === "add") {
            // Include adds for accepted or pending (default to modified)
            if (status === "accepted" || status === "pending") {
              lines.push(line.content);
            }
          } else if (line.type === "remove") {
            // Include removes only for rejected
            if (status === "rejected") {
              lines.push(line.content);
            }
          }
        }
      }

      return lines.join("\n");
    },
    [hunks]
  );

  const handleAccept = (hunkId: string) => {
    const next = new Map(hunkStatuses);
    next.set(hunkId, "accepted");
    setHunkStatuses(next);
    // Side effect outside of setState - cleaner and more predictable
    onResolve?.(computeResolvedText(next));
  };

  const handleReject = (hunkId: string) => {
    const next = new Map(hunkStatuses);
    next.set(hunkId, "rejected");
    setHunkStatuses(next);
    onResolve?.(computeResolvedText(next));
  };

  const hunkHasChanges = (hunk: Hunk) =>
    hunk.lines.some((l) => l.type !== "unchanged");

  return (
    <div
      data-testid="diff-viewer"
      style={{
        fontFamily: "monospace",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      {hunks.map((hunk) => {
        const status = hunkStatuses.get(hunk.id) ?? "pending";
        const hasChanges = hunkHasChanges(hunk);
        const isResolved = status !== "pending";

        return (
          <div
            key={hunk.id}
            style={{
              borderBottom: "1px solid #eee",
            }}
          >
            {hunk.lines.map((line, lineIdx) => {
              // When resolved, show the resolved version
              let effectiveType = line.type;
              if (isResolved && hasChanges) {
                if (status === "accepted" && line.type === "remove") {
                  return null; // Hide removed lines when accepted
                }
                if (status === "rejected" && line.type === "add") {
                  return null; // Hide added lines when rejected
                }
                effectiveType = "unchanged"; // Remaining lines shown as unchanged
              }

              const bgColor =
                effectiveType === "add"
                  ? "#e6ffed"
                  : effectiveType === "remove"
                    ? "#ffeef0"
                    : "transparent";

              const prefix =
                line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";

              return (
                <div
                  key={lineIdx}
                  data-diff-type={line.type}
                  style={{
                    display: "flex",
                    backgroundColor: bgColor,
                  }}
                >
                  <span
                    style={{
                      width: "40px",
                      textAlign: "right",
                      padding: "0 8px",
                      color: "#999",
                      backgroundColor: "#f8f8f8",
                      borderRight: "1px solid #eee",
                      userSelect: "none",
                    }}
                  >
                    {line.lineNumber.old ?? ""}
                  </span>
                  <span
                    style={{
                      width: "40px",
                      textAlign: "right",
                      padding: "0 8px",
                      color: "#999",
                      backgroundColor: "#f8f8f8",
                      borderRight: "1px solid #eee",
                      userSelect: "none",
                    }}
                  >
                    {line.lineNumber.new ?? ""}
                  </span>
                  <span
                    style={{
                      width: "20px",
                      textAlign: "center",
                      color:
                        line.type === "add"
                          ? "#22863a"
                          : line.type === "remove"
                            ? "#cb2431"
                            : "#999",
                    }}
                  >
                    {prefix}
                  </span>
                  <span style={{ flex: 1, padding: "0 8px" }}>
                    {line.content}
                  </span>
                </div>
              );
            })}

            {/* Action buttons for unresolved change hunks */}
            {hasChanges && !isResolved && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  padding: "8px",
                  backgroundColor: "#f8f8f8",
                }}
              >
                <button
                  data-testid={`accept-${hunk.id}`}
                  onClick={() => handleAccept(hunk.id)}
                  style={{
                    padding: "4px 12px",
                    backgroundColor: "#28a745",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Accept
                </button>
                <button
                  data-testid={`reject-${hunk.id}`}
                  onClick={() => handleReject(hunk.id)}
                  style={{
                    padding: "4px 12px",
                    backgroundColor: "#dc3545",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
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
