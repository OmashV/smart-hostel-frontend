/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ChatbotContext = createContext(undefined);

const DEFAULT_CHAT_CONFIG = {
  role: "owner",
  dashboardState: {
    dashboard: "owner",
    floorId: "all",
    roomId: "all",
    selectedVisual: null,
    selectedFilters: {}
  },
  onAction: null
};

export function ChatbotProvider({ children }) {
  const [chatConfig, setChatConfig] = useState(DEFAULT_CHAT_CONFIG);

  const registerChatContext = useCallback((config = {}) => {
    setChatConfig((prev) => ({
      ...prev,
      ...config,
      dashboardState: {
        ...prev.dashboardState,
        ...(config.dashboardState || {})
      }
    }));
  }, []);

  const updateSelectedVisual = useCallback((selectedVisual) => {
    setChatConfig((prev) => ({
      ...prev,
      dashboardState: {
        ...prev.dashboardState,
        selectedVisual
      }
    }));
  }, []);

  const clearSelectedVisual = useCallback(() => {
    setChatConfig((prev) => ({
      ...prev,
      dashboardState: {
        ...prev.dashboardState,
        selectedVisual: null
      }
    }));
  }, []);

  const clearChatContext = useCallback(() => {
    setChatConfig(DEFAULT_CHAT_CONFIG);
  }, []);

  const value = useMemo(
    () => ({
      chatConfig,
      registerChatContext,
      updateSelectedVisual,
      clearSelectedVisual,
      clearChatContext
    }),
    [
      chatConfig,
      registerChatContext,
      updateSelectedVisual,
      clearSelectedVisual,
      clearChatContext
    ]
  );

  return <ChatbotContext.Provider value={value}>{children}</ChatbotContext.Provider>;
}

export function useChatbotContext() {
  const context = useContext(ChatbotContext);

  if (context === undefined) {
    throw new Error("useChatbotContext must be used within a ChatbotProvider");
  }

  return context;
}