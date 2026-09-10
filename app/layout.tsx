import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "TEST — NSSA Skeet Tracker", description: "Private user-account testing environment. Test records only.", robots: { index: false, follow: false } };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <aside style={{ background: "#92400e", color: "#fff", padding: "12px 16px", textAlign: "center", fontSize: "16px" }} aria-label="Test environment">
          <strong>TEST SITE — User Accounts</strong>
          <span style={{ display: "block" }}>Test records only. Entries here do not transfer to your live tracker.</span>
        </aside>
        {children}
      </body>
    </html>
  );
}
