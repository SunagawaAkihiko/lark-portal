'use strict';
// ============================================================
// lark-portal 配信サーバー
//
// ルーティング:
//   GET /staff    → 会社Wi-Fiチェック後に index.html を返す（スタッフ用入口）
//   GET /staff/   → /staff へリダイレクト
//   その他        → 制限なしで静的ファイルを配信（管理者用）
//
// Wi-Fi制限の仕組み:
//   環境変数 SHOP_{KEY}_IP に登録された拠点IPからのアクセスのみ /staff を許可する。
//   打刻サーバーと同じ命名規則。例: SHOP_A_IP=1.2.3.4  SHOP_B_IP=5.6.7.8
// ============================================================

const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');
const app  = express();
const PORT = process.env.PORT || 3000;

// 施設外からのアクセスを許可する Lark open_id のリスト（カンマ区切り環境変数）
const ALLOWED_OPEN_IDS  = new Set(
  (process.env.ALLOWED_OPEN_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
);
const COOKIE_SECRET      = process.env.COOKIE_SECRET || 'glad-staff-secret';
const STAFF_ACCESS_COOKIE = 'glad_staff_access';

// Render / Cloudflare 等のリバースプロキシ背後でも実クライアントIPを取得する
app.set('trust proxy', 1);
app.use(cookieParser(COOKIE_SECRET));

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
    const openId = req.signedCookies[STAFF_ACCESS_COOKIE];
    if (openId && ALLOWED_OPEN_IDS.has(openId)) return next();
  }

  const clientIP  = getClientIP(req);
  const officeIPs = getAllOfficeIPs();

  if (officeIPs.has(clientIP)) {
    return next(); // 会社Wi-Fi → 通常配信
  }

  console.log(`[Wi-Fi制限] 拒否 IP=${clientIP}`);
  res.status(403).sendFile(path.join(__dirname, 'wifi-required.html'));
}

// ---- Lark OAuth ルート ----
// GET /auth/lark → Lark認可画面にリダイレクト
app.get('/auth/lark', (req, res) => {
  const appId = process.env.LARK_APP_ID;
  if (!appId || ALLOWED_OPEN_IDS.size === 0) {
    return res.status(403).sendFile(path.join(__dirname, 'wifi-required.html'));
  }
  const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/auth/lark/callback`);
  res.redirect(`https://open.larksuite.com/open-apis/authen/v1/index?redirect_uri=${redirectUri}&app_id=${appId}`);
});

// GET /auth/lark/callback → コード交換 → open_id確認 → Cookie発行
app.get('/auth/lark/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).sendFile(path.join(__dirname, 'wifi-required.html'));

  try {
    const basicAuth = Buffer.from(
      `${process.env.LARK_APP_ID}:${process.env.LARK_APP_SECRET}`
    ).toString('base64');

    // 認可コード → ユーザーアクセストークン
    const tokenRes  = await fetch('https://open.larksuite.com/open-apis/authen/v1/oidc/access_token', {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', code }),
    });
    const tokenData = await tokenRes.json();
    const userToken = tokenData.data?.access_token;
    if (!userToken) throw new Error('ユーザートークン取得失敗');

    // ユーザー情報取得
    const userRes  = await fetch('https://open.larksuite.com/open-apis/authen/v1/user_info', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const userData = await userRes.json();
    const openId   = userData.data?.open_id;
    const name     = userData.data?.name;

    console.log(`[auth/lark] ログイン試行: ${name} (${openId})`);

    if (!ALLOWED_OPEN_IDS.has(openId)) {
      console.log(`[auth/lark] アクセス拒否: ${name} (${openId})`);
      return res.status(403).sendFile(path.join(__dirname, 'wifi-required.html'));
    }

    // 許可済み → 署名付きCookieを発行して /staff へリダイレクト
    res.cookie(STAFF_ACCESS_COOKIE, openId, {
      signed:   true,
      httpOnly: true,
      maxAge:   30 * 24 * 60 * 60 * 1000, // 30日
      sameSite: 'lax',
    });
    console.log(`[auth/lark] アクセス許可: ${name} (${openId})`);
    res.redirect('/staff');
  } catch (e) {
    console.error('[auth/lark] エラー:', e.message);
    res.status(500).send('認証エラーが発生しました。もう一度お試しください。');
  }
});

// ---- キャッシュバスティング用バージョン定数 ----
// デプロイのたびにこの値を更新する。
// URLに _v パラメータがない or 古い場合は最新バージョン付きURLへリダイレクトし、
// LarkのWebViewがキャッシュを使わず最新のHTMLを取得するよう強制する。
const PAGE_VERSION = 'v9';

// HTMLページへのアクセス時に _v パラメータが最新でなければリダイレクトする
app.use((req, res, next) => {
  if (!req.path.endsWith('.html')) return next();
  if (req.query._v === PAGE_VERSION) return next();
  const params = new URLSearchParams(req.query);
  params.set('_v', PAGE_VERSION);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.redirect(302, `${req.path}?${params.toString()}`);
});

// ---- /staff ルート（スタッフ個人スマホ用・Wi-Fi限定）----
// URLを /staff（末尾スラッシュなし）にすることで、index.html内の
// 相対リンク（care-record.html等）が /care-record.html に正しく解決される
app.get('/staff', requireOfficeWifi, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// /staff/ → /staff にリダイレクト（末尾スラッシュ対策）
app.get('/staff/', (req, res) => {
  res.redirect(301, '/staff');
});

// ---- その他のルート（管理者用・制限なし）----
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
