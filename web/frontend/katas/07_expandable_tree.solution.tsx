import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type TreeNode = {
  id: string;
  label: string;
  /** If present, treated as preloaded children. */
  children?: TreeNode[];
  /** Set to true when children are lazy-loaded (even if children not yet present). */
  hasChildren?: boolean;
};

type VisibleNode = {
  node: TreeNode;
  depth: number;
  parentId: string | null;
};

type ExpandableTreeProps = {
  roots: TreeNode[];
  loadChildren?: (nodeId: string) => Promise<TreeNode[]>;
  onSelect?: (nodeId: string) => void;
};

function flattenTree(
  roots: TreeNode[],
  expanded: Set<string>,
  childrenById: Record<string, TreeNode[] | undefined>
): VisibleNode[] {
  const out: VisibleNode[] = [];

  const walk = (nodes: TreeNode[], depth: number, parentId: string | null) => {
    for (const node of nodes) {
      out.push({ node, depth, parentId });
      const isExpanded = expanded.has(node.id);
      if (!isExpanded) continue;
      const children = node.children ?? childrenById[node.id] ?? [];
      if (children.length > 0) walk(children, depth + 1, node.id);
    }
  };

  walk(roots, 0, null);
  return out;
}

export function ExpandableTree({
  roots,
  loadChildren,
  onSelect,
}: ExpandableTreeProps): React.ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState<Set<string>>(() => new Set());
  const [childrenById, setChildrenById] = useState<
    Record<string, TreeNode[] | undefined>
  >({});

  const requestIdByNodeRef = useRef<Record<string, number>>({});
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const visible = useMemo(
    () => flattenTree(roots, expanded, childrenById),
    [childrenById, expanded, roots]
  );

  useEffect(() => {
    if (visible.length === 0) return;
    if (activeId && visible.some((v) => v.node.id === activeId)) return;
    setActiveId(visible[0].node.id);
  }, [activeId, visible]);

  useEffect(() => {
    if (!activeId) return;
    itemRefs.current[activeId]?.focus();
  }, [activeId]);

  const getChildren = useCallback(
    (node: TreeNode): TreeNode[] => node.children ?? childrenById[node.id] ?? [],
    [childrenById]
  );

  const isExpandable = useCallback(
    (node: TreeNode): boolean =>
      node.hasChildren === true || getChildren(node).length > 0,
    [getChildren]
  );

  const ensureChildrenLoaded = useCallback(
    async (node: TreeNode) => {
      if (!loadChildren) return;
      if (node.children) return;
      if (childrenById[node.id]) return;
      if (!node.hasChildren) return;

      const nextReqId = (requestIdByNodeRef.current[node.id] ?? 0) + 1;
      requestIdByNodeRef.current[node.id] = nextReqId;
      setLoading((prev) => new Set(prev).add(node.id));

      try {
        const kids = await loadChildren(node.id);
        const isStale = requestIdByNodeRef.current[node.id] !== nextReqId;
        if (isStale) return;
        setChildrenById((prev) => ({ ...prev, [node.id]: kids }));
      } finally {
        setLoading((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    },
    [childrenById, loadChildren]
  );

  const toggle = useCallback(
    async (node: TreeNode) => {
      if (!isExpandable(node)) return;

      const willExpand = !expanded.has(node.id);
      if (willExpand) {
        await ensureChildrenLoaded(node);
      }

      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    },
    [ensureChildrenLoaded, expanded, isExpandable]
  );

  const select = useCallback(
    (node: TreeNode) => {
      setSelectedId(node.id);
      onSelect?.(node.id);
    },
    [onSelect]
  );

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    visible.forEach((v, i) => m.set(v.node.id, i));
    return m;
  }, [visible]);

  const parentById = useMemo(() => {
    const m = new Map<string, string | null>();
    visible.forEach((v) => m.set(v.node.id, v.parentId));
    return m;
  }, [visible]);

  const onKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (!activeId) return;
      const idx = indexById.get(activeId);
      if (idx == null) return;

      const current = visible[idx].node;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = visible[Math.min(visible.length - 1, idx + 1)];
          if (next) setActiveId(next.node.id);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const next = visible[Math.max(0, idx - 1)];
          if (next) setActiveId(next.node.id);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (!isExpandable(current)) break;
          if (!expanded.has(current.id)) {
            await toggle(current);
          } else {
            const kids = getChildren(current);
            if (kids.length > 0) setActiveId(kids[0].id);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (expanded.has(current.id)) {
            await toggle(current);
            break;
          }
          const parentId = parentById.get(current.id);
          if (parentId) setActiveId(parentId);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          select(current);
          break;
        }
      }
    },
    [
      activeId,
      expanded,
      getChildren,
      indexById,
      isExpandable,
      parentById,
      select,
      toggle,
      visible,
    ]
  );

  if (visible.length === 0) {
    return (
      <div style={{ fontFamily: "system-ui", color: "#666" }}>Empty tree</div>
    );
  }

  return (
    <div
      role="tree"
      aria-label="Expandable tree"
      onKeyDown={onKeyDown}
      style={{
        fontFamily: "system-ui",
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: 8,
        maxWidth: 420,
      }}
      data-testid="tree"
    >
      {visible.map(({ node, depth }) => {
        const expandable = isExpandable(node);
        const isExpanded = expanded.has(node.id);
        const isLoading = loading.has(node.id);
        const isSelected = selectedId === node.id;

        return (
          <div
            key={node.id}
            role="treeitem"
            aria-expanded={expandable ? isExpanded : undefined}
            aria-selected={isSelected}
            style={{ paddingLeft: depth * 16 }}
          >
            <button
              ref={(el) => {
                itemRefs.current[node.id] = el;
              }}
              type="button"
              onClick={() => {
                setActiveId(node.id);
                select(node);
              }}
              onDoubleClick={() => void toggle(node)}
              style={{
                width: "100%",
                textAlign: "left",
                border: 0,
                background: isSelected ? "#e7f1ff" : "transparent",
                padding: "6px 8px",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
              data-testid={`tree-item-${node.id}`}
            >
              <span
                aria-hidden
                style={{ width: 16, display: "inline-block", color: "#444" }}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggle(node);
                }}
              >
                {expandable ? (isExpanded ? "▾" : "▸") : "•"}
              </span>
              <span style={{ flex: 1 }}>{node.label}</span>
              {isLoading && (
                <span style={{ color: "#666", fontSize: 12 }}>Loading…</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

