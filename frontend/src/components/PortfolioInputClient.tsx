"use client";

import dynamic from "next/dynamic";

// Rendered only in the browser because it reads the saved draft from localStorage.
const PortfolioInput = dynamic(() => import("./PortfolioInput"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl border border-line bg-surface" />,
});

export default PortfolioInput;
