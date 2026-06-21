import { useCallback, useState } from 'react';

/**
 * Custom React hook to manage inspector mode activation status and active selected node state.
 */
export function useInspectorMode() {
  const [isInspectorModeActive, setIsInspectorModeActive] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const toggleInspectorMode = useCallback(() => {
    setIsInspectorModeActive((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedNodeId(null);
      }
      return next;
    });
  }, []);

  const resetInspectorMode = useCallback(() => {
    setIsInspectorModeActive(false);
    setSelectedNodeId(null);
  }, []);

  return {
    isInspectorModeActive,
    selectedNodeId,
    setSelectedNodeId,
    toggleInspectorMode,
    resetInspectorMode,
  };
}
