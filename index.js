// 通用中繼代理 — 部署於 Render Web Services
// 用途：讓 Cloudflare Worker 可以間接抓取需要非 CF IP 的網站資料

const http = require('http');

const ALLOWED_HOSTS = new Set(['www.wantgoo.com', 'tw.stock.yahoo.com']);

const WG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'zh-TW,zh;q=0.9',
  'Referer': 'https://www.wantgoo.com/stock/margin-trading/market-price/taiex',
};

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0',
};

function headersFor(hostname) {
  if (hostname === 'tw.stock.yahoo.com') return YAHOO_HEADERS;
  return WG_HEADERS;
}

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // CORS — 允許任何來源呼叫
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Health check
  if (url.pathname === '/' || url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, service: 'stock-proxy', time: new Date().toISOString() }));
    return;
  }

  // 代理：/proxy?url=<完整目標URL>
  if (url.pathname === '/proxy') {
    const target = url.searchParams.get('url');
    if (!target) { res.writeHead(400); res.end('Missing url param'); return; }

    let parsed;
    try { parsed = new URL(target); }
    catch { res.writeHead(400); res.end('Invalid url'); return; }

    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      res.writeHead(403);
      res.end('Host not in allowlist: ' + parsed.hostname);
      return;
    }

    try {
      const r = await fetch(target, { headers: headersFor(parsed.hostname) });
      const body = await r.text();
      const ct = r.headers.get('content-type') || 'text/html';
      res.writeHead(r.status, {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=600',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(502);
      res.end('Upstream error: ' + e.message);
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`stock-proxy listening on :${PORT}`);
});
