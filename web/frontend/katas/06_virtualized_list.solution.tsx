import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type VirtualizedListProps<T> = {
  items: T[];
  height: number;
  itemHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey?: (item: T, index: number) => React.Key;
};

export type VirtualizedListHandle = {
  scrollToIndex: (index: number) => void;
};

export const VirtualizedList = React.forwardRef(function VirtualizedList<T>(
  {
    items,
    height,
    itemHeight,
    overscan = 3,
    renderItem,
    getKey,
  }: VirtualizedListProps<T>,
  ref: React.ForwardedRef<VirtualizedListHandle>
): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const rafRef = useRef<number | null>(null);
  const latestScrollTopRef = useRef(0);

  const totalHeight = items.length * itemHeight;

  const { startIndex, endIndex } = useMemo(() => {
    if (items.length === 0) return { startIndex: 0, endIndex: -1 };

    const rawStart = Math.floor(scrollTop / itemHeight);
    const rawEnd = Math.floor((scrollTop + height) / itemHeight);

    const start = Math.max(0, rawStart - overscan);
    const end = Math.min(items.length - 1, rawEnd + overscan);
    return { startIndex: start, endIndex: end };
  }, [height, itemHeight, items.length, overscan, scrollTop]);

  const visibleItems = useMemo(() => {
    if (endIndex < startIndex) return [];
    return items.slice(startIndex, endIndex + 1).map((item, i) => {
      const index = startIndex + i;
      return { item, index };
    });
  }, [endIndex, items, startIndex]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const nextScrollTop = e.currentTarget.scrollTop;
    latestScrollTopRef.current = nextScrollTop;

    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setScrollTop(latestScrollTopRef.current);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      scrollToIndex: (index: number) => {
        const clamped = Math.max(0, Math.min(items.length - 1, index));
        const top = clamped * itemHeight;
        containerRef.current?.scrollTo({ top });
      },
    }),
    [itemHeight, items.length]
  );

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      style={{
        height,
        overflowY: "auto",
        border: "1px solid #ccc",
        borderRadius: 6,
        fontFamily: "system-ui",
      }}
      role="list"
      aria-label="Virtualized list"
      data-testid="virtualized-list"
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map(({ item, index }) => {
          const key = getKey ? getKey(item, index) : index;
          return (
            <div
              key={key}
              style={{
                position: "absolute",
                top: index * itemHeight,
                left: 0,
                right: 0,
                height: itemHeight,
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                boxSizing: "border-box",
                borderBottom: "1px solid #eee",
                background: index % 2 === 0 ? "#fff" : "#fafafa",
              }}
              role="listitem"
              data-testid={`row-${index}`}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}) as <T>(
  props: VirtualizedListProps<T> & { ref?: React.Ref<VirtualizedListHandle> }
) => React.ReactElement;

