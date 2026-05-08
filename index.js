// 玩股網中繼代理 — 部署於 Render Web Services
// 用途：讓 Cloudflare Worker 可以間接抓取玩股網的內部 API
// (玩股網會擋 CF→CF 直連，但允許其他主機如 Render)

const http = require('http');

const ALLOWED_HOSTS = new Set([
  'www.wantgoo.com',
  'www.tpex.org.tw',     // 櫃買中心（OTC 上櫃資料來源）
  'tw.stock.yahoo.com',  // 奇摩股市
]);

const WG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'zh-TW,zh;q=0.9',
  'Referer': 'https://www.wantgoo.com/stock/margin-trading/market-price/taiex',
};

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
    res.end(JSON.stringify({ ok: true, service: 'wantgoo-proxy', time: new Date().toISOString() }));
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
      const r = await fetch(target, { headers: WG_HEADERS });
      const body = await r.text();
      res.writeHead(r.status, {
        'Content-Type': r.headers.get('content-type') || 'application/json',
        'Cache-Control': 'public, max-age=3600',
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
  console.log(`wantgoo-proxy listening on :${PORT}`);
});
