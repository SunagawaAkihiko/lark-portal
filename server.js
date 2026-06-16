'use strict';
// ============================================================
// lark-portal 配信サーバー
//
// ルーティング:
//   GET /staff    → 会社Wi-Fiチェック後に index.html を返す（スタッフ用入口）
//   GET /staff/   → /staff へリダイレクト
//   スタッフ共通ツール(.html) → 会社Wi-FiチェックまたはLark認証Cookieが必要
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

// 施設外からのアクセスを許可する Lark open_id のリスト（カンマ区切り環境変数）
const ALLOWED_OPEN_IDS  = new Set(
  (process.env.ALLOWED_OPEN_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
);
const COOKIE_SECRET      = process.env.COOKIE_SECRET || 'glad-staff-secret';
const STAFF_ACCESS_COOKIE = 'glad_staff_access';
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
    .divider { margin: 28px 0 0; border: none; border-top: 1px solid #e2e8f0; }
    .lark-auth-section { margin-top: 20px; }
    .lark-auth-section p { font-size: 13px; color: #718096; margin-bottom: 12px; }
    .lark-login-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: #1456f0; color: #fff; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📶</div>
    <h1>会社Wi-Fiに接続してください</h1>
    <p>このツールは会社のWi-Fi接続中のみ<br>ご利用いただけます。</p>
    <div class="hint">スマートフォンのWi-Fi設定から<br>会社のWi-Fiに接続後、<br>再度アクセスしてください。</div>
    <button class="retry-btn" onclick="location.reload()">再試行</button>
    <hr class="divider">
    <div class="lark-auth-section">
      <p>大浦家・上津役家のアカウントは<br>施設外からアクセスできます</p>
      <a href="/auth/lark" class="lark-login-btn">
        <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="40" height="40" rx="8" fill="white" fill-opacity="0.2"/>
          <path d="M20 8L32 14V26L20 32L8 26V14L20 8Z" fill="white"/>
        </svg>
        Larkで認証する
      </a>
    </div>
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
  let cookie = `${name}=${encoded}; HttpOnly; SameSite=Lax`;
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
// 登録済み拠点IP または 許可済みLarkアカウントのCookieがあればアクセスを許可する
function requireOfficeWifi(req, res, next) {
  // 許可済みLarkアカウントのCookieがあれば施設外からもアクセス許可
  if (ALLOWED_OPEN_IDS.size > 0) {
    const openId = getSignedCookie(req, STAFF_ACCESS_COOKIE);
    if (openId && ALLOWED_OPEN_IDS.has(openId)) return next();
  }

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

// ---- Lark OAuth ルート ----
// GET /auth/lark → Lark認可画面にリダイレクト
app.get('/auth/lark', (req, res) => {
  const appId = process.env.LARK_APP_ID;
  if (!appId) return sendWifiRequired(res);
  const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/auth/lark/callback`);
  res.redirect(`https://open.larksuite.com/open-apis/authen/v1/index?redirect_uri=${redirectUri}&app_id=${appId}`);
});

// GET /auth/lark/callback → コード交換 → open_id確認 → Cookie発行
app.get('/auth/lark/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return sendWifiRequired(res, 400);

  try {
    // app_access_token取得（oidc/access_tokenの認証にはBasic認証ではなくこのトークンのBearerが必要）
    const appTokenRes  = await fetch('https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET }),
    });
    const appTokenData = await appTokenRes.json();
    const appAccessToken = appTokenData.app_access_token;
    if (!appAccessToken) {
      console.error('[auth/lark] アプリトークン取得失敗:', JSON.stringify(appTokenData));
      throw new Error('アプリトークン取得失敗');
    }

    // 認可コード → ユーザーアクセストークン
    const tokenRes  = await fetch('https://open.larksuite.com/open-apis/authen/v1/oidc/access_token', {
      method: 'POST',
      headers: { Authorization: `Bearer ${appAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', code }),
    });
    const tokenData = await tokenRes.json();
    const userToken = tokenData.data?.access_token;
    if (!userToken) {
      console.error('[auth/lark] ユーザートークン取得失敗:', JSON.stringify(tokenData));
      throw new Error('ユーザートークン取得失敗');
    }

    // ユーザー情報取得
    const userRes  = await fetch('https://open.larksuite.com/open-apis/authen/v1/user_info', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const userData = await userRes.json();
    const openId   = userData.data?.open_id;
    const name     = userData.data?.name;

    console.log(`[auth/lark] ログイン試行: ${name} (${openId})`);

    if (!ALLOWED_OPEN_IDS.has(openId)) {
      console.log(`[auth/lark] アクセス拒否: ${name} (${openId}) ← ALLOWED_OPEN_IDS に追加してください`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(403).send(
        `<html><body style="font-family:sans-serif;padding:40px;text-align:center">` +
        `<h2>アクセスできません</h2>` +
        `<p>このアカウント（${name}）は許可リストに登録されていません。</p>` +
        `<p style="color:#666;font-size:13px">open_id: <code>${openId}</code></p>` +
        `</body></html>`
      );
    }

    // 許可済み → 署名付きCookieを発行して /staff へリダイレクト
    setSignedCookie(res, STAFF_ACCESS_COOKIE, openId, {
      maxAge:  30 * 24 * 60 * 60 * 1000, // 30日
      secure:  req.secure || req.headers['x-forwarded-proto'] === 'https',
    });
    console.log(`[auth/lark] アクセス許可: ${name} (${openId})`);
    res.redirect('/staff');
  } catch (e) {
    console.error('[auth/lark] エラー:', e.message);
    res.status(500).send('認証エラーが発生しました。もう一度お試しください。');
  }
});

// ---- 管理者専用ページ（URLを知っている管理者本人のみが使う想定）----
// これらのページは個別のWi-Fi制限・Lark認証チェックの対象外とする
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
const PAGE_VERSION = 'v13';

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
