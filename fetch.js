const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });
  const p = await ctx.newPage();
  const r = await p.goto('https://www.nccn.org/guidelines/category_1', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('HTTP status', r.status());
  const text = await p.innerText('body');
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^Version:\s*(\d+\.\d{4})$/);
    if (m) out[lines[i - 1]] = m[1];
  }
  const n = Object.keys(out).length;
  console.log('parsed', n, 'guidelines');
  if (n < 50) { console.error('Too few guidelines parsed; page blocked or changed'); process.exit(1); }
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync('versions.json', JSON.stringify({ source: 'nccn.org/guidelines/category_1', versions: sorted }, null, 1) + '\n');
  await b.close();
})();
