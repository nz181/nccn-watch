const { chromium } = require('playwright');
const fs = require('fs');

const CATEGORIES = {
  category_1: 'Treatment by Cancer Type',
  category_2: 'Detection, Prevention, and Risk Reduction',
  category_3: 'Supportive Care',
  category_4: 'Specific Populations',
};

async function scrape(page, cat) {
  const r = await page.goto('https://www.nccn.org/guidelines/' + cat, { waitUntil: 'networkidle', timeout: 60000 });
  console.log('HTTP status', cat, r.status());
  const text = await page.innerText('body');
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const out = {};
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^Version:\s*(\d+\.\d{4})$/);
    if (m) out[lines[i - 1]] = m[1];
  }
  console.log('parsed', Object.keys(out).length, 'guidelines in', cat);
  return out;
}
const sortObj = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  });
  const p = await ctx.newPage();

  // Category 1 is required and keeps the original "versions" key (unchanged contract).
  const c1 = await scrape(p, 'category_1');
  if (Object.keys(c1).length < 50) { console.error('Too few guidelines parsed in category_1; page blocked or changed'); process.exit(1); }

  // Categories 2-4 are best effort: a failure here must not block category 1.
  const other = {};
  for (const cat of ['category_2', 'category_3', 'category_4']) {
    try {
      const v = await scrape(p, cat);
      if (Object.keys(v).length === 0) console.error('WARNING: 0 guidelines parsed in', cat);
      other[CATEGORIES[cat]] = sortObj(v);
    } catch (e) {
      console.error('WARNING: failed to scrape', cat, e.message);
    }
  }

  fs.writeFileSync('versions.json', JSON.stringify({
    source: 'nccn.org/guidelines/category_1 (+ category_2-4 under other_categories)',
    fetched_at: new Date().toISOString(),
    versions: sortObj(c1),
    other_categories: other,
  }, null, 1) + '\n');
  await b.close();
})();
