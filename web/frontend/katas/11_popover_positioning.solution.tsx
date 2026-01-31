import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type Placement = "bottom" | "top" | "right" | "left";

type UsePopoverPositionOptions = {
  placement?: Placement;
  offset?: number;
  viewportPadding?: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function computePosition(
  anchorRect: DOMRect,
  popoverRect: DOMRect,
  placement: Placement,
  offset: number
): { top: number; left: number } {
  switch (placement) {
    case "top":
      return {
        top: anchorRect.top - popoverRect.height - offset,
        left: anchorRect.left + (anchorRect.width - popoverRect.width) / 2,
      };
    case "bottom":
      return {
        top: anchorRect.bottom + offset,
        left: anchorRect.left + (anchorRect.width - popoverRect.width) / 2,
      };
    case "left":
      return {
        top: anchorRect.top + (anchorRect.height - popoverRect.height) / 2,
        left: anchorRect.left - popoverRect.width - offset,
      };
    case "right":
      return {
        top: anchorRect.top + (anchorRect.height - popoverRect.height) / 2,
        left: anchorRect.right + offset,
      };
  }
}

function flipIfNeeded(
  anchorRect: DOMRect,
  popoverRect: DOMRect,
  placement: Placement,
  offset: number,
  viewportPadding: number
): Placement {
  const { innerWidth: vw, innerHeight: vh } = window;
  const pos = computePosition(anchorRect, popoverRect, placement, offset);
  const overTop = pos.top < viewportPadding;
  const overBottom = pos.top + popoverRect.height > vh - viewportPadding;
  const overLeft = pos.left < viewportPadding;
  const overRight = pos.left + popoverRect.width > vw - viewportPadding;

  if (placement === "bottom" && overBottom && !overTop) return "top";
  if (placement === "top" && overTop && !overBottom) return "bottom";
  if (placement === "left" && overLeft && !overRight) return "right";
  if (placement === "right" && overRight && !overLeft) return "left";
  return placement;
}

export function usePopoverPosition(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement>,
  popoverRef: React.RefObject<HTMLElement>,
  options: UsePopoverPositionOptions = {}
) {
  const { placement = "bottom", offset = 8, viewportPadding = 8 } = options;
  const [style, setStyle] = useState<React.CSSProperties>({ position: "fixed" });
  const [resolvedPlacement, setResolvedPlacement] = useState<Placement>(placement);

  const recompute = useCallback(() => {
    if (!isOpen) return;
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    const nextPlacement = flipIfNeeded(
      anchorRect,
      popoverRect,
      placement,
      offset,
      viewportPadding
    );
    const pos = computePosition(anchorRect, popoverRect, nextPlacement, offset);

    const { innerWidth: vw, innerHeight: vh } = window;
    const top = clamp(pos.top, viewportPadding, vh - viewportPadding - popoverRect.height);
    const left = clamp(pos.left, viewportPadding, vw - viewportPadding - popoverRect.width);

    setResolvedPlacement(nextPlacement);
    setStyle({ position: "fixed", top, left, zIndex: 1000 });
  }, [anchorRef, isOpen, offset, placement, popoverRef, viewportPadding]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    if (!isOpen) return;

    const onScroll = () => recompute();
    const onResize = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [isOpen, recompute]);

  return { style, placement: resolvedPlacement, recompute };
}

export function PopoverDemo(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { style } = usePopoverPosition(open, anchorRef, popoverRef, {
    placement: "bottom",
    offset: 10,
  });

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      const a = anchorRef.current;
      const p = popoverRef.current;
      const target = e.target as Node;
      if (a?.contains(target)) return;
      if (p?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div style={{ fontFamily: "system-ui", padding: 20 }}>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        Toggle popover
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={{
            ...style,
            width: 260,
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
            boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
          }}
          role="dialog"
          aria-label="Popover"
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Popover</div>
          <div style={{ color: "#444", fontSize: 13 }}>
            Positions via DOM rects, flips if needed, and clamps to the viewport.
          </div>
        </div>
      )}
    </div>
  );
}

