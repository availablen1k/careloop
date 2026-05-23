import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareLoop — Making Invisible Care Work Visible",
  description: "AI-powered care coordination platform for families supporting elderly loved ones living alone. Gentle task reminders, passive context integration, and safe family escalation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
