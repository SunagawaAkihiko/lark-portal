'use strict';
// ============================================================
// lark-portal 配信サーバー
//
// ルーティング:
//   GET /staff    → 会社Wi-Fiチェック後に index.html を返す（スタッフ用入口）
//   GET /staff/   → /staff へリダイレクト
//   スタッフ共通ツール(.html) → 会社Wi-Fiチェックが必要
//   管理者専用ページ(PUBLIC_HTML_PAGES) → 制限なし（URLを知っている管理者のみ使用）
//
// Wi-Fi制限の仕組み:
//   環境変数 SHOP_{KEY}_IP に登録された拠点IPからのアクセスのみ許可する。
//   打刻サーバーと同じ命名規則。例: SHOP_A_IP=1.2.3.4  SHOP_B_IP=5.6.7.8
//   admin.htmlにアクセスするとCookie(glad_admin_access)が発行され、
//   以降admin.html内のカードから開く各ページもWi-Fi制限なしで閲覧できる。
// ============================================================

const express = require('express');
const path    = require('path');
const crypto  = require('crypto');
const app  = express();
const PORT = process.env.PORT || 3000;

const COOKIE_SECRET      = process.env.COOKIE_SECRET || 'glad-staff-secret';
const ADMIN_ACCESS_COOKIE = 'glad_admin_access';

// ---- Wi-Fi制限ページHTML（ファイル読み込みではなく直接埋め込み）----
const WIFI_REQUIRED_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>会社Wi-Fiに接続してください</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f0f4f8; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 40px 32px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #1a202c; margin-bottom: 12px; }
    p { font-size: 15px; color: #4a5568; line-height: 1.7; margin-bottom: 8px; }
    .hint { margin-top: 28px; background: #ebf8ff; border-radius: 10px; padding: 16px; font-size: 14px; color: #2b6cb0; line-height: 1.6; }
    .retry-btn { display: inline-block; margin-top: 28px; padding: 14px 32px; background: #4299e1; color: #fff; border-radius: 10px; font-size: 16px; font-weight: 600; text-decoration: none; cursor: pointer; border: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📶</div>
    <h1>会社Wi-Fiに接続してください</h1>
    <p>このツールは会社のWi-Fi接続中のみ<br>ご利用いただけます。</p>
    <div class="hint">スマートフォンのWi-Fi設定から<br>会社のWi-Fiに接続後、<br>再度アクセスしてください。</div>
    <button class="retry-btn" onclick="location.reload()">再試行</button>
  </div>
</body>
</html>`;

function sendWifiRequired(res, status = 403) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(status).send(WIFI_REQUIRED_HTML);
}

// ---- Cookie ユーティリティ（crypto 組み込みモジュールで実装）----
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const result = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    try { result[key] = decodeURIComponent(part.slice(idx + 1).trim()); } catch { result[key] = part.slice(idx + 1).trim(); }
  }
  return result;
}

function getSignedCookie(req, name) {
  const raw = parseCookies(req)[name];
  if (!raw || !raw.startsWith('s:')) return null;
  const withoutPrefix = raw.slice(2);
  const lastDot = withoutPrefix.lastIndexOf('.');
  if (lastDot < 0) return null;
  const value = withoutPrefix.slice(0, lastDot);
  const sig   = withoutPrefix.slice(lastDot + 1);
  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('base64');
  return sig === expected ? value : null;
}

function setSignedCookie(res, name, value, options = {}) {
  const sig = crypto.createHmac('sha256', COOKIE_SECRET).update(value).digest('base64');
  const encoded = encodeURIComponent(`s:${value}.${sig}`);
  let cookie = `${name}=${encoded}; HttpOnly; SameSite=Lax; Path=/`;
  if (options.maxAge) cookie += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
  if (options.secure)  cookie += '; Secure';
  res.setHeader('Set-Cookie', cookie);
}

// Render / Cloudflare 等のリバースプロキシ背後でも実クライアントIPを取得する
app.set('trust proxy', 1);

// ---- アクセス元IP取得 ----
// Cloudflare の CF-Connecting-IP → x-forwarded-for → req.ip の順に試す
function getClientIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    ''
  );
}

// ---- 全拠点のIPアドレスを環境変数から収集 ----
// 打刻サーバーと同じ SHOP_*_IP 命名規則を使用する
function getAllOfficeIPs() {
  const ips = new Set();
  for (const [key, val] of Object.entries(process.env)) {
    if (/^SHOP_[A-Z0-9]+_IP$/.test(key)) {
      val.split(',').forEach(ip => {
        const trimmed = ip.trim();
        if (trimmed) ips.add(trimmed);
      });
    }
  }
  return ips;
}

// ---- 会社Wi-Fiチェックミドルウェア ----
// 登録済み拠点IP または 管理者Cookieがあればアクセスを許可する
function requireOfficeWifi(req, res, next) {
  // admin.html（URLを知っている管理者のみが開く前提）経由のCookieがあれば許可
  if (getSignedCookie(req, ADMIN_ACCESS_COOKIE) === '1') return next();

  const clientIP  = getClientIP(req);
  const officeIPs = getAllOfficeIPs();

  if (officeIPs.has(clientIP)) {
    return next(); // 会社Wi-Fi → 通常配信
  }

  console.log(`[Wi-Fi制限] 拒否 IP=${clientIP}`);
  sendWifiRequired(res);
}

// ---- 管理者専用ページ（URLを知っている管理者本人のみが使う想定）----
// これらのページは個別のWi-Fi制限チェックの対象外とする
const PUBLIC_HTML_PAGES = new Set([
  'wifi-required.html',
  'admin.html',
  'payment-collection.html',
  'customer-register.html',
  'customer-register-preview.html',
  'staff-register.html',
  'staff-register-preview.html',
  'staff-admin-edit.html',
  'staff-admin-edit-preview.html',
  'service-schedule.html',
  'supply-admin.html',
  'salary-admin.html',
  'performance-report.html',
  'shift.html',
]);

// ---- スタッフ共通ツールページにもWi-Fi制限をかける ----
// /staff のカードを経由せず直接URLを指定して開かれた場合も同じくチェックする
app.use((req, res, next) => {
  if (!req.path.endsWith('.html')) return next();
  const filename = path.basename(req.path);
  if (PUBLIC_HTML_PAGES.has(filename)) return next();
  return requireOfficeWifi(req, res, next);
});

// ---- キャッシュバスティング用バージョン定数 ----
// デプロイのたびにこの値を更新する。
// URLに _v パラメータがない or 古い場合は最新バージョン付きURLへリダイレクトし、
// LarkのWebViewがキャッシュを使わず最新のHTMLを取得するよう強制する。
const PAGE_VERSION = 'v14';

// HTMLページへのアクセス時に _v パラメータが最新でなければリダイレクトする
app.use((req, res, next) => {
  if (!req.path.endsWith('.html')) return next();
  if (req.query._v === PAGE_VERSION) return next();
  const params = new URLSearchParams(req.query);
  params.set('_v', PAGE_VERSION);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.redirect(302, `${req.path}?${params.toString()}`);
});

// ---- 管理者用Cookie発行 ----
// admin.html（URLを知っている管理者本人のみが開く想定）にアクセスした際、
// 以降admin.html内のカードから開く各ページもWi-Fi制限なしで閲覧できるようCookieを発行する
app.get('/admin.html', (req, res, next) => {
  setSignedCookie(res, ADMIN_ACCESS_COOKIE, '1', {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30日
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
  });
  next();
});

// ---- /staff ルート（スタッフ個人スマホ用・Wi-Fi限定）----
// URLを /staff（末尾スラッシュなし）にすることで、index.html内の
// 相対リンク（care-record.html等）が /care-record.html に正しく解決される
app.get('/staff', requireOfficeWifi, (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// /staff/ → /staff にリダイレクト（末尾スラッシュ対策）
app.get('/staff/', (req, res) => {
  res.redirect(301, '/staff');
});

// ---- 静的ファイル配信 ----
// .html はここに来る前に上のミドルウェアでWi-Fi制限済み（PUBLIC_HTML_PAGES以外）。
// CSS・JS・画像等はno-cache対象外でそのまま配信する。
// HTMLはWebViewキャッシュを防ぐためno-cacheヘッダーを付与する
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

app.listen(PORT, () => {
  const ips = [...getAllOfficeIPs()];
  console.log(`lark-portal 起動中 (port=${PORT})`);
  console.log(`登録済み拠点IP: ${ips.length > 0 ? ips.join(', ') : '未設定（/staff は全拒否）'}`);
});
