const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'vendor');
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });

const files = [
  ['https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js', 'chart.umd.min.js'],
  ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', 'xlsx.full.min.js'],
  ['https://cdn.jsdelivr.net/npm/particles.js@2.0.0/particles.min.js', 'particles.min.js'],
];

(async () => {
  for (const [url, name] of files) {
    const r = await fetch(url);
    if (!r.ok) { console.log('FAIL', name, r.status); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(path.join(dir, name), buf);
    console.log('OK', name, buf.length, 'bytes');
  }
  // Manrope fonts: try Google CSS first; fall back to Fontsource via jsDelivr
  const weights = [400, 500, 600, 700, 800];
  let css = '';
  try {
    const cssUrl = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap';
    const cssResp = await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' } });
    css = await cssResp.text();
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))];
    let i = 0;
    for (const u of urls) {
      const r = await fetch(u);
      if (!r.ok) throw new Error('font ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      const fname = 'manrope-' + (i++) + '.woff2';
      fs.writeFileSync(path.join(dir, 'fonts', fname), buf);
      css = css.split(u).join('fonts/' + fname);
      console.log('OK font', fname, buf.length);
    }
  } catch (e) {
    console.log('Google fonts unavailable (' + e.message + '), using Fontsource');
    css = '';
    for (const w of weights) {
      for (const subset of ['cyrillic', 'latin']) {
        const u = 'https://cdn.jsdelivr.net/fontsource/fonts/manrope@latest/' + subset + '-' + w + '-normal.woff2';
        const r = await fetch(u);
        if (!r.ok) { console.log('FONT FAIL', u, r.status); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        const fname = 'manrope-' + subset + '-' + w + '.woff2';
        fs.writeFileSync(path.join(dir, 'fonts', fname), buf);
        const range = subset === 'cyrillic' ? 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116' : 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
        css += "@font-face{font-family:'Manrope';font-style:normal;font-weight:" + w + ";font-display:swap;src:url('fonts/" + fname + "') format('woff2');unicode-range:" + range + ";}\n";
        console.log('OK font', fname, buf.length);
      }
    }
  }
  fs.writeFileSync(path.join(dir, 'manrope.css'), css);
  console.log('OK manrope.css', css.length);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
