# wantgoo-proxy

Relay proxy for fetching WantGoo internal APIs from Cloudflare Workers.

## Why
WantGoo is hosted on Cloudflare and blocks requests from other Cloudflare Workers (CF→CF). Render runs on different infrastructure so it can fetch successfully and relay the data back.

## Endpoints
- `GET /` — health check
- `GET /proxy?url=<encoded URL>` — proxy a request to www.wantgoo.com

## Deploy on Render
1. Push this folder to a GitHub repo
2. New Web Service → connect repo
3. Runtime: Node, Build: `npm install`, Start: `npm start`
4. Free plan, region: Singapore
