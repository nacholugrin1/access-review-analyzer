import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Access Review Analyzer",
  description:
    "Runs a user access review in the browser: finds leavers with active access, orphan and dormant accounts, segregation-of-duties conflicts and privileged access gaps, then drives the recertification and produces an audit-ready report.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
