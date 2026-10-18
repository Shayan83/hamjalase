import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "هم‌جلسه | دستیار جلسات",
  description: "دستیار هوشمند فارسی برای مدیریت جلسات Nextcloud",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
