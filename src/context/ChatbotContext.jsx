/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ChatbotContext = createContext(undefined);

export function ChatbotProvider({ children }) {
  const [chatConfig, setChatConfig] = useState({
    role: "owner",
    dashboardState: {
      floorId: "all",
      roomId: "all"
    },
    onAction: null
  });

  const registerChatContext = useCallback((config) => {
    setChatConfig((prev) => ({
      ...prev,
      ...config,
      dashboardState: {
        ...prev.dashboardState,
        ...(config?.dashboardState || {})
      }
    }));
  }, []);

  const clearChatContext = useCallback(() => {
    setChatConfig({
      role: "owner",
      dashboardState: {
        floorId: "all",
        roomId: "all"
      },
      onAction: null
    });
  }, []);

  const value = useMemo(
    () => ({
      chatConfig,
      registerChatContext,
      clearChatContext
    }),
    [chatConfig, registerChatContext, clearChatContext]
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
