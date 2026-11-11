import PortfolioInput from "@/components/PortfolioInputClient";

export default function Home() {
  return (
    <main className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Your portfolio</h2>
        <p className="mt-1 text-sm text-muted">
          Enter each ticker and the dollar amount you hold. Lock any holding you never want to sell.
        </p>
      </div>
      <PortfolioInput />
    </main>
  );
}
