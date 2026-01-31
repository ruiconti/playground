import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type PresenceUser = {
  id: string;
  name: string;
  color: string;
  cursorIndex: number;
};

type PresenceEditorProps = {
  value: string;
  onChange: (next: string) => void;
  remoteUsers: PresenceUser[];
  onLocalCursorChange?: (cursorIndex: number) => void;
  throttleMs?: number;
};

function useThrottledCallback<T>(cb: (value: T) => void, throttleMs: number) {
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  }, [cb]);

  const lastCallRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const latestRef = useRef<T | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (value: T) => {
      latestRef.current = value;
      const now = Date.now();
      const elapsed = now - lastCallRef.current;

      const fire = () => {
        lastCallRef.current = Date.now();
        if (latestRef.current != null) cbRef.current(latestRef.current);
      };

      if (elapsed >= throttleMs) {
        if (timeoutRef.current != null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        fire();
        return;
      }

      if (timeoutRef.current != null) return;
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        fire();
      }, throttleMs - elapsed);
    },
    [throttleMs]
  );
}

function indexToLineCol(text: string, index: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(text.length, index));
  const before = text.slice(0, clamped);
  const lastNl = before.lastIndexOf("\n");
  const line = before.split("\n").length - 1;
  const col = lastNl === -1 ? before.length : before.length - lastNl - 1;
  return { line, col };
}

export function PresenceEditor({
  value,
  onChange,
  remoteUsers,
  onLocalCursorChange,
  throttleMs = 100,
}: PresenceEditorProps): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  const [charWidth, setCharWidth] = useState(8);
  const [lineHeight, setLineHeight] = useState(18);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCharWidth(rect.width || 8);
    setLineHeight(rect.height || 18);
  }, []);

  const emitLocalCursor = useThrottledCallback<number>(
    (cursorIndex) => onLocalCursorChange?.(cursorIndex),
    throttleMs
  );

  const handleSelect = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    emitLocalCursor(el.selectionStart ?? 0);
  }, [emitLocalCursor]);

  const padding = 10;

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 820 }}>
      <h3 style={{ margin: "0 0 8px" }}>Presence indicators</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 260px",
          gap: 12,
          alignItems: "start",
        }}
      >
        <div style={{ position: "relative" }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onSelect={handleSelect}
            onKeyUp={handleSelect}
            onMouseUp={handleSelect}
            rows={10}
            style={{
              width: "100%",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 14,
              lineHeight: `${lineHeight}px`,
              padding,
              borderRadius: 6,
              border: "1px solid #ccc",
              boxSizing: "border-box",
            }}
          />

          {/* Overlay remote cursors (monospace approximation) */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
            }}
          >
            {remoteUsers.map((u) => {
              const { line, col } = indexToLineCol(value, u.cursorIndex);
              const top = padding + line * lineHeight;
              const left = padding + col * charWidth;
              return (
                <div key={u.id} style={{ position: "absolute", top, left }}>
                  <div
                    style={{
                      width: 2,
                      height: lineHeight,
                      background: u.color,
                      borderRadius: 1,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: -18,
                      left: 4,
                      fontSize: 11,
                      padding: "1px 4px",
                      borderRadius: 4,
                      background: u.color,
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: 10,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Remote users</div>
          {remoteUsers.length === 0 ? (
            <div style={{ color: "#666" }}>None</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {remoteUsers.map((u) => {
                const { line, col } = indexToLineCol(value, u.cursorIndex);
                return (
                  <li key={u.id} style={{ marginBottom: 6 }}>
                    <span style={{ color: u.color, fontWeight: 600 }}>
                      {u.name}
                    </span>{" "}
                    <span style={{ color: "#555" }}>
                      (line {line + 1}, col {col + 1})
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Hidden measurement element */}
      <span
        ref={measureRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 14,
          lineHeight: "18px",
        }}
      >
        M
      </span>
    </div>
  );
}

