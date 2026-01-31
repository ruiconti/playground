import React, { useMemo, useRef, useState } from "react";

type Range = { id: string; start: number; end: number };
type NormalizedRange = { start: number; end: number };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeRanges(textLength: number, ranges: Range[]): NormalizedRange[] {
  const normalized = ranges
    .map((r) => {
      const a = clamp(r.start, 0, textLength);
      const b = clamp(r.end, 0, textLength);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      return { start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: NormalizedRange[] = [];
  for (const r of normalized) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...r });
      continue;
    }
    if (r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

function renderWithHighlights(text: string, ranges: Array<{ start: number; end: number }>) {
  if (ranges.length === 0) return <span>{text}</span>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (let i = 0; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    if (cursor < start) {
      parts.push(<span key={`t-${i}`}>{text.slice(cursor, start)}</span>);
    }

    if (start === end) {
      parts.push(
        <span
          key={`c-${i}`}
          style={{
            display: "inline-block",
            width: 2,
            height: "1em",
            background: "#111",
            verticalAlign: "text-bottom",
          }}
          aria-label="Cursor"
        />
      );
    } else {
      parts.push(
        <mark
          key={`m-${i}`}
          style={{ background: "#ffe08a", padding: 0 }}
        >
          {text.slice(start, end)}
        </mark>
      );
    }

    cursor = end;
  }

  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return parts;
}

export function MultiCursorSelectionDemo(): React.ReactElement {
  const [text, setText] = useState(
    "Try selecting text in the textarea and clicking “Add current selection”.\nYou can also add multiple cursors."
  );
  const [ranges, setRanges] = useState<Range[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const normalized = useMemo(
    () => normalizeRanges(text.length, ranges),
    [ranges, text.length]
  );

  const addRange = (start: number, end: number) => {
    setRanges((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, start, end },
    ]);
  };

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 720 }}>
      <h3 style={{ margin: "0 0 8px" }}>Multi-cursor / multi-selection</h3>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        style={{
          width: "100%",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 14,
          padding: 10,
          borderRadius: 6,
          border: "1px solid #ccc",
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            const el = textareaRef.current;
            if (!el) return;
            addRange(el.selectionStart, el.selectionEnd);
          }}
        >
          Add current selection
        </button>
        <button
          type="button"
          onClick={() => {
            const el = textareaRef.current;
            if (!el) return;
            addRange(el.selectionStart, el.selectionStart);
          }}
        >
          Add cursor at caret
        </button>
        <button type="button" onClick={() => setRanges([])}>
          Clear
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#555" }}>
          Raw ranges:
        </div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {ranges.length === 0 ? (
            <li style={{ color: "#666" }}>None</li>
          ) : (
            ranges.map((r) => (
              <li key={r.id}>
                [{r.start}, {r.end}){" "}
                <button
                  type="button"
                  onClick={() => setRanges((prev) => prev.filter((x) => x.id !== r.id))}
                >
                  remove
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#555" }}>
          Normalized ranges (merged):
        </div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {normalized.length === 0 ? (
            <li style={{ color: "#666" }}>None</li>
          ) : (
            normalized.map((r, i) => (
              <li key={`${r.start}-${r.end}-${i}`}>
                [{r.start}, {r.end})
              </li>
            ))
          )}
        </ul>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: "#555" }}>Highlighted view:</div>
        <pre
          style={{
            marginTop: 6,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ddd",
            background: "#fafafa",
            whiteSpace: "pre-wrap",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {renderWithHighlights(text, normalized)}
        </pre>
      </div>
    </div>
  );
}
