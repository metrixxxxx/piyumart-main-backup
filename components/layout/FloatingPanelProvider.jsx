"use client";

import { createContext, useCallback, useContext, useId, useMemo, useState } from "react";

const FloatingPanelContext = createContext(null);

export default function FloatingPanelProvider({ children }) {
  const [activePanel, setActivePanel] = useState(null);
  const openPanel = useCallback(id => setActivePanel(id), []);
  const closePanel = useCallback(id => setActivePanel(current => current === id ? null : current), []);
  const closeAllPanels = useCallback(() => setActivePanel(null), []);
  const value = useMemo(() => ({ activePanel, openPanel, closePanel, closeAllPanels }), [activePanel, openPanel, closePanel, closeAllPanels]);

  return <FloatingPanelContext.Provider value={value}>{children}</FloatingPanelContext.Provider>;
}

export function useFloatingPanels() {
  const context = useContext(FloatingPanelContext);
  if (!context) throw new Error("Floating panels require FloatingPanelProvider.");
  return context;
}

export function useFloatingPanel() {
  const id = useId();
  const { activePanel, openPanel, closePanel } = useFloatingPanels();
  const open = useCallback(() => openPanel(id), [id, openPanel]);
  const close = useCallback(() => closePanel(id), [id, closePanel]);
  return { id, isOpen: activePanel === id, openPanel: open, closePanel: close };
}
