/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from "react";

const ChatbotContext = createContext(undefined);

export function ChatbotProvider({ children }) {
  const [chatConfig, setChatConfig] = useState({
    role: "owner",
    dashboardState: {
      dashboard: "owner",
      floorId: "all",
      roomId: "all",
      selectedVisual: null,
      selectedFilters: {}
    },
    onAction: null
  });

  const registerChatContext = (config) => {
    setChatConfig((prev) => ({
      ...prev,
      ...config,
      dashboardState: {
        ...prev.dashboardState,
        ...(config?.dashboardState || {})
      }
    }));
  };

  const updateSelectedVisual = (selectedVisual) => {
    setChatConfig((prev) => ({
      ...prev,
      dashboardState: {
        ...prev.dashboardState,
        selectedVisual
      }
    }));
  };

  const clearSelectedVisual = () => {
    setChatConfig((prev) => ({
      ...prev,
      dashboardState: {
        ...prev.dashboardState,
        selectedVisual: null
      }
    }));
  };

  const clearChatContext = () => {
    setChatConfig({
      role: "owner",
      dashboardState: {
        dashboard: "owner",
        floorId: "all",
        roomId: "all",
        selectedVisual: null,
        selectedFilters: {}
      },
      onAction: null
    });
  };

  const value = useMemo(
    () => ({
      chatConfig,
      registerChatContext,
      updateSelectedVisual,
      clearSelectedVisual,
      clearChatContext
    }),
    [chatConfig]
  );

  return (
    <ChatbotContext.Provider value={value}>
      {children}
    </ChatbotContext.Provider>
  );
}

export function useChatbotContext() {
  const context = useContext(ChatbotContext);

  if (context === undefined) {
    throw new Error("useChatbotContext must be used within a ChatbotProvider");
  }

  return context;
}
