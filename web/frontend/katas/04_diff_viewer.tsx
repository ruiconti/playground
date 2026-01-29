import React from "react";

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

export function computeDiff(original: string, modified: string): Hunk[] {
  throw new Error("TODO");
}

export function DiffViewer(props: DiffViewerProps): React.ReactElement {
  throw new Error("TODO");
}
