import React, { useState, useRef, useCallback, useEffect } from "react";

type ReorderItem = {
  id: string;
  content: string;
};

type ReorderListProps = {
  items: ReorderItem[];
  /** Called with the new item order after a reorder. */
  onReorder: (items: ReorderItem[]) => void;
  /** Render function for each item. Falls back to item.content if not provided. */
  renderItem?: (item: ReorderItem) => React.ReactNode;
};

type DropTarget = {
  index: number;
  position: "above" | "below";
} | null;

export function ReorderList({
  items,
  onReorder,
  renderItem,
}: ReorderListProps): React.ReactElement {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [announcement, setAnnouncement] = useState("");

  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup announcement timer on unmount
  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string) => {
    // Clear any pending timer
    if (announceTimerRef.current) {
      clearTimeout(announceTimerRef.current);
    }
    setAnnouncement(message);
    // Clear after screen reader has time to read it
    announceTimerRef.current = setTimeout(() => setAnnouncement(""), 1000);
  }, []);

  const reorderItems = useCallback(
    (fromIndex: number, toIndex: number): ReorderItem[] => {
      if (fromIndex === toIndex) return items;

      const newItems = [...items];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      return newItems;
    },
    [items]
  );

  // --- Drag handlers ---

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: "above" | "below" =
      e.clientY < midpoint ? "above" : "below";

    // Calculate effective drop index
    const dropIndex = position === "above" ? index : index + 1;

    // Don't show indicator at no-op positions
    if (dropIndex === draggedIndex || dropIndex === draggedIndex + 1) {
      setDropTarget(null);
      return;
    }

    setDropTarget({ index, position });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || dropTarget === null) return;

    let insertIndex = dropTarget.position === "above"
      ? dropTarget.index
      : dropTarget.index + 1;

    // Adjust for removal
    if (draggedIndex < insertIndex) {
      insertIndex--;
    }

    const newItems = reorderItems(draggedIndex, insertIndex);
    onReorder(newItems);

    setDraggedIndex(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  // --- Keyboard handlers ---

  const handleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    if (!e.altKey) return;

    if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      const newItems = reorderItems(index, index - 1);
      onReorder(newItems);

      // Focus follows the moved item
      requestAnimationFrame(() => {
        itemRefs.current[index - 1]?.focus();
      });

      announce(
        `Moved ${items[index].content} to position ${index} of ${items.length}`
      );
    }

    if (e.key === "ArrowDown" && index < items.length - 1) {
      e.preventDefault();
      const newItems = reorderItems(index, index + 1);
      onReorder(newItems);

      // Focus follows the moved item
      requestAnimationFrame(() => {
        itemRefs.current[index + 1]?.focus();
      });

      announce(
        `Moved ${items[index].content} to position ${index + 2} of ${items.length}`
      );
    }
  };

  // --- Render ---

  return (
    <div>
      {/* Screen reader live region */}
      <div
        data-testid="live-region"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {announcement}
      </div>

      <ul
        role="list"
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          position: "relative",
        }}
      >
        {items.map((item, index) => {
          const isDragged = draggedIndex === index;
          const showIndicatorAbove =
            dropTarget?.index === index && dropTarget.position === "above";
          const showIndicatorBelow =
            dropTarget?.index === index && dropTarget.position === "below";

          return (
            <React.Fragment key={item.id}>
              {/* Drop indicator above */}
              {showIndicatorAbove && (
                <div
                  data-testid="drop-indicator"
                  style={{
                    height: "2px",
                    backgroundColor: "#007bff",
                    margin: "0 8px",
                  }}
                />
              )}

              <li
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                role="listitem"
                data-testid={`item-${item.id}`}
                aria-label={`${item.content}, item ${index + 1} of ${items.length}`}
                draggable
                tabIndex={0}
                onDragStart={handleDragStart(index)}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onKeyDown={handleKeyDown(index)}
                style={{
                  padding: "12px 16px",
                  margin: "4px 0",
                  backgroundColor: "#fff",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  cursor: "grab",
                  opacity: isDragged ? 0.5 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {renderItem ? renderItem(item) : item.content}
              </li>

              {/* Drop indicator below */}
              {showIndicatorBelow && (
                <div
                  data-testid="drop-indicator"
                  style={{
                    height: "2px",
                    backgroundColor: "#007bff",
                    margin: "0 8px",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
}
