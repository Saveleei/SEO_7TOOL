"use client";

export function QuotePrintButton() {
  return <button className="quote-print-button" type="button" onClick={() => window.print()}>Печать / сохранить PDF</button>;
}
