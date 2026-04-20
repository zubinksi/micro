/**
 * Deeplink generators for peer payment apps.
 * These open the native app with amount + note pre-filled.
 */

export function venmoDeeplink(username: string, amount: number, note: string): string {
  const encoded = encodeURIComponent(note);
  return `venmo://paycharge?txn=pay&recipients=${username}&amount=${amount.toFixed(2)}&note=${encoded}`;
}

export function zelleDeeplink(amount: number, note: string): string {
  // Zelle doesn't support deep linking with pre-fill; fall back to app open
  return `zelle://`;
}

export function cashAppDeeplink(cashtag: string, amount: number, note: string): string {
  const encoded = encodeURIComponent(note);
  return `https://cash.app/$${cashtag}/${amount.toFixed(2)}?note=${encoded}`;
}

export function settlementNote(marketQuestion: string): string {
  const short = marketQuestion.length > 60 ? marketQuestion.slice(0, 57) + '…' : marketQuestion;
  return `Micro bet: ${short}`;
}

/**
 * Format a currency amount for display (IOU points / USD).
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}
