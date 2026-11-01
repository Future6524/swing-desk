import type { Metadata } from "next";
import Link from "next/link";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Swing Desk", template: "%s · Swing Desk" },
  description: "Swing trading setups: watchlist, live trade history and a full archive.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="site-header">
          <div className="wrap header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden>◆</span>
              <span>Swing Desk</span>
            </Link>
            <nav className="nav">
              <Link href="/">Watchlist</Link>
              <Link href="/archive">Archive</Link>
              <Link href="/admin" className="nav-admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="wrap main">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            Setups are published for educational purposes and are not investment advice. Every update is recorded
            with a timestamp and never edited after the fact.
          </div>
        </footer>
      </body>
    </html>
  );
}
