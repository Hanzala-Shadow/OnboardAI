export const metadata = {
  title: "OnboardAI portfolio preview",
  description: "An embeddable preview of the OnboardAI client-operations agent.",
};

export default function EmbedPreview() {
  return <main className="embed-shell">
    <section className="embed-card">
      <div className="embed-top"><span className="brand-mark">O</span><span className="system-state"><i /> Interactive demo</span></div>
      <div className="embed-copy"><p className="kicker">Trustworthy client operations</p><h1>From request to<br /><em>approved workflow.</em></h1><p>Structured extraction, policy controls, human approval, safe tool execution, and a complete audit trail.</p></div>
      <div className="embed-flow"><span>Interpret</span><b>→</b><span>Check</span><b>→</b><span>Approve</span><b>→</b><span>Execute</span></div>
      <a href="/" target="_blank" rel="noreferrer">Open live workflow <span>↗</span></a>
    </section>
  </main>;
}
