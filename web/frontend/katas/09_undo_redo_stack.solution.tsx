import React, { useCallback, useMemo, useState } from "react";

type UseUndoRedoOptions<T> = {
  maxSize?: number;
  isEqual?: (a: T, b: T) => boolean;
};

export function useUndoRedo<T>(
  initial: T,
  options: UseUndoRedoOptions<T> = {}
) {
  const { maxSize = 100, isEqual = Object.is } = options;

  const [past, setPast] = useState<T[]>([]);
  const [present, setPresent] = useState<T>(initial);
  const [future, setFuture] = useState<T[]>([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setPresent((prev) => {
        const resolved = typeof next === "function" ? (next as any)(prev) : next;
        if (isEqual(prev, resolved)) return prev;

        setPast((p) => {
          const nextPast = [...p, prev];
          if (nextPast.length > maxSize) nextPast.shift();
          return nextPast;
        });
        setFuture([]); // branching: new edit clears redo
        return resolved;
      });
    },
    [isEqual, maxSize]
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];

      setPresent((curr) => {
        setFuture((f) => [curr, ...f]);
        return previous;
      });

      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];

      setPresent((curr) => {
        setPast((p) => [...p, curr]);
        return next;
      });

      return f.slice(1);
    });
  }, []);

  const reset = useCallback((next: T) => {
    setPast([]);
    setFuture([]);
    setPresent(next);
  }, []);

  return { past, present, future, set, undo, redo, reset, canUndo, canRedo };
}

export function UndoRedoDemo(): React.ReactElement {
  const { present, set, undo, redo, canUndo, canRedo } = useUndoRedo<string>(
    "Edit me"
  );

  const stats = useMemo(
    () => ({ length: present.length }),
    [present.length]
  );

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 520 }}>
      <h3 style={{ margin: "0 0 8px" }}>Undo / Redo</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" onClick={redo} disabled={!canRedo}>
          Redo
        </button>
      </div>

      <input
        value={present}
        onChange={(e) => set(e.target.value)}
        style={{
          marginTop: 10,
          width: "100%",
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          boxSizing: "border-box",
        }}
      />

      <div style={{ marginTop: 8, color: "#555", fontSize: 12 }}>
        length: {stats.length}
      </div>
    </div>
  );
}

