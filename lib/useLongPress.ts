import { useRef, useCallback } from "react";

export function useLongPress(onLongPress: () => void, delay = 600) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const start = useCallback(() => {
    fired.current = false;
    timerRef.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  // Prevent the normal click firing after a long press
  const handleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (fired.current) e.stopPropagation();
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    onClick: handleClick,
  };
}
