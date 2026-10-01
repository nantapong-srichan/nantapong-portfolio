// Single switch for every demo-only fallback (fake slips, on-screen OTP codes, dev webhook secret,
// simulated bank, table launcher). On in dev; OFF by default in production so a real deploy never
// accepts fake money. The public portfolio is a demo with no real money, so its production deploy
// opts in deliberately with DEMO_SANDBOX=1. QRPAY_SANDBOX=0 turns it off in dev.
export function sandboxEnabled(): boolean {
  return (process.env.NODE_ENV !== "production" && process.env.QRPAY_SANDBOX !== "0") || process.env.DEMO_SANDBOX === "1";
}
