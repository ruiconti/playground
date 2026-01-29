import React from "react";

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

export function ReorderList(props: ReorderListProps): React.ReactElement {
  throw new Error("TODO");
}
