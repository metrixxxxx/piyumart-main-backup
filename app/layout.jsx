import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";
import { Suspense } from "react";
import NavigationProgress from "@/components/NavigationProgress";
import ChatWidget from "@/components/chatbot/ChatWidget";
import Footer from "@/components/Footer";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100">
        <Suspense>
          <NavigationProgress />
        </Suspense>
        <SessionWrapper>
          {children}
          <ChatWidget />
        </SessionWrapper>
        <Footer />
      </body>
    </html>
  );
}