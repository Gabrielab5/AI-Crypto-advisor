export default function BrandLogo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--c-accent)]/10 border border-[var(--c-accent)]/20 mb-4">
        <svg className="w-6 h-6 text-[var(--c-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <h1 className="text-[var(--c-text)] text-xl font-bold tracking-tight">AI Crypto Advisor</h1>
      <p className="text-[var(--c-muted)] text-sm mt-1">Personalized signals &amp; market intel</p>
    </div>
  );
}
