import type { Metadata, Viewport } from "next";
import "./fonts/fonts.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: "عزم | رفيقك الذكي للدراسة والتركيز",
  description:
    "عزم (Azm AI) — رفيقك الذكي للدراسة والتركيز. حماية ذكية لانتباه الطالب عبر تصفح قائم على النية، بدل الحجب التقليدي. Your intelligent study companion.",
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0612",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#120A1F",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#EDE9FE",
              fontFamily: "var(--font-plex-arabic), 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif",
              borderRadius: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
