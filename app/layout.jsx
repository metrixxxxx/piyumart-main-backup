import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import { Suspense } from "react";
import NavigationProgress from "@/components/NavigationProgress";
import ChatWidget from "@/components/chatbot/ChatWidget";
import RouteFooter from "@/components/RouteFooter";
import BaoWorkspaceBackGuard from "@/components/BaoWorkspaceBackGuard";
import FloatingPanelProvider from "@/components/layout/FloatingPanelProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Suspense>
          <NavigationProgress />
        </Suspense>
        <SessionWrapper>
          <FloatingPanelProvider>
            <BaoWorkspaceBackGuard />
            {children}
            <ChatWidget />
          </FloatingPanelProvider>
        </SessionWrapper>
        <Suspense fallback={null}>
          <RouteFooter />
        </Suspense>
      </body>
    </html>
  );
}
