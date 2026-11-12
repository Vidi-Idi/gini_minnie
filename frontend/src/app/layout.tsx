import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gini_minnie · Portfolio Analyzer",
  description: "Analyze a US stock and ETF portfolio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <header className="mb-8 flex items-baseline justify-between">
            <h1 className="text-xl font-semibold tracking-tight">gini_minnie</h1>
            <span className="text-sm text-muted">Portfolio analyzer · NYSE &amp; NASDAQ</span>
          </header>
          {children}
          <footer className="mt-12 border-t border-line pt-4 text-xs text-muted">
            For informational purposes only, not investment advice.
          </footer>
        </div>
      </body>
    </html>
  );
}
