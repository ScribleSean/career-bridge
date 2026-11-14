// The monthly AI pulse: hand-checked, one issue per month.
// An item counts only if the vendor's own page, dated inside the window, says the product does it.
// `quote` is a phrase from that page to Ctrl-F. `learn` is a skill O*NET 31.0 rates for the job
// (importance 1-5, onetonline.org/link/summary/<soc>.00): the part of the work the change hands back to the person.
export const PULSE = {
  issue: 'November 2026',
  from: '2026-10-01', to: '2026-11-13', checked: '2026-11-13',
  jobs: [
    {soc: '43-6014', learn: {name: 'Writing', im: 3.75}, items: []},
    {soc: '43-4051', learn: {name: 'Active Listening', im: 4.0}, items: []},
    {soc: '41-2031', learn: {name: 'Persuasion', im: 3.88}, items: [
      {what: 'Finds low-stock items, prepares purchase orders and moves stock between stores, with the owner’s approval.',
        product: 'Lightspeed AI', date: '2026-10-15', flags: ['Beta'],
        url: 'https://www.lightspeedhq.com/news/lightspeed-ai-expands-from-insights-to-action-with-new-agentic-capabilities-for-retail/',
        quote: 'identify low-stock products, prepare purchase orders, update product data'}]},
    {soc: '43-3031', learn: {name: 'Critical Thinking', im: 3.25}, items: [
      {what: 'Drafts invoices from saved documents for a person to review and send, and flags transactions ready to post.',
        product: 'QuickBooks (Intuit Intelligence)', date: '2026-10-14', flags: ['Beta', 'Canada'],
        url: 'https://quickbooks.intuit.com/ca/resources/product-update/intuit-intelligence-october-2026/',
        quote: 'draft invoices for you to quickly review and send'}]},
    {soc: '29-1141', learn: {name: 'Critical Thinking', im: 4.0}, items: [
      {what: 'Sorts patient messages and drafts replies for nurses to review, edit and send.',
        product: 'Epic (Art)', date: '2026-11-04', flags: [],
        url: 'https://www.epic.com/epic/post/nurses-answer-patient-messages-faster-gain-time-for-care-with-epic-ai/',
        quote: 'drafting replies for nurses to review, edit, and send'}]},
  ],
};

// Rules every issue must pass; tests run this on PULSE.
export function pulseProblems(p = PULSE) {
  const out = [];
  for (const j of p.jobs) {
    if (!/^\d\d-\d{4}$/.test(j.soc)) out.push(`${j.soc}: bad SOC`);
    if (!(j.learn?.name && j.learn.im >= 3 && j.learn.im <= 5)) out.push(`${j.soc}: learn-next skill must be one O*NET rates 3+ of 5`);
    for (const i of j.items) {
      if (!(i.date >= p.from && i.date <= p.to)) out.push(`${j.soc}: ${i.date} is outside ${p.from} to ${p.to}`);
      if (!/^https:\/\//.test(i.url || '')) out.push(`${j.soc}: needs the vendor's https page`);
      if (!i.quote || i.quote.trim().split(/\s+/).length >= 15) out.push(`${j.soc}: needs a quote under 15 words`);
      if (!i.what || !i.product) out.push(`${j.soc}: needs what and product`);
    }
  }
  return out;
}
