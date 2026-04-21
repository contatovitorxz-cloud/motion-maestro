import { useCallback, useRef, useState } from "react";
import type { Clip } from "@/pages/Editor";

/**
 * Snapshot-based undo/redo for the clips array.
 * We only push to history on "commit" (end of drag, after split, after delete...).
 */
export function useTimelineHistory(initial: Clip[]) {
  const [present, setPresent] = useState<Clip[]>(initial);
  const past = useRef<Clip[][]>([]);
  const future = useRef<Clip[][]>([]);

  const reset = useCallback((next: Clip[]) => {
    past.current = [];
    future.current = [];
    setPresent(next);
  }, []);

  const commit = useCallback((next: Clip[]) => {
    past.current.push(present);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    setPresent(next);
  }, [present]);

  // Local "live" update without committing — used while dragging
  const setLive = useCallback((next: Clip[] | ((prev: Clip[]) => Clip[])) => {
    setPresent(prev => (typeof next === "function" ? (next as any)(prev) : next));
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return null;
    const prev = past.current.pop()!;
    future.current.push(present);
    setPresent(prev);
    return prev;
  }, [present]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return null;
    const next = future.current.pop()!;
    past.current.push(present);
    setPresent(next);
    return next;
  }, [present]);

  return { clips: present, reset, commit, setLive, undo, redo };
}
