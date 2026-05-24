import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import { Suspense } from "react";
import NavigationProgress from "@/components/NavigationProgress";
import ChatWidget from "@/components/chatbot/ChatWidget";
import Footer from "@/components/Footer";  // ← dagdag

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen flex flex-col">
        <Suspense>
          <NavigationProgress />
        </Suspense>

        <SessionWrapper>
          {children}
          <ChatWidget />
          <Footer />  {/* ← dagdag dito */}
        </SessionWrapper>
      </body>
    </html>
  );
}