import type { Metadata } from "next";
import "./globals.css";
import { env } from "cloudflare:workers";
import { AccountStatus } from "@/components/account-status";

const isTest = () => (env as unknown as {APP_ORIGIN?:string}).APP_ORIGIN !== "https://sk33t.net";
export function generateMetadata(): Metadata { return { title: isTest() ? "TEST — NSSA Skeet Tracker" : "NSSA Skeet Tracker", description: "Private shooting records, averages, classifications, and registered shoot history.", robots: { index: false, follow: false } }; }

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {isTest() && <aside style={{ background: "#92400e", color: "#fff", padding: "12px 16px", textAlign: "center", fontSize: "16px" }} aria-label="Test environment">
          <strong>TEST SITE — User Accounts</strong>
          <span style={{ display: "block" }}>Test records only. Entries here do not transfer to your live tracker.</span>
        </aside>}
        <AccountStatus />
        {children}
        <form className="site-signout" action="/api/auth/logout" method="post" style={{textAlign:"center",padding:16}}><button type="submit">Sign out of tracker</button></form>
      </body>
    </html>
  );
}
