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

const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

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
// 登録済み拠点IP以外からのアクセスは wifi-required.html を返す
function requireOfficeWifi(req, res, next) {
  const clientIP  = getClientIP(req);
  const officeIPs = getAllOfficeIPs();

  if (officeIPs.has(clientIP)) {
    return next(); // 会社Wi-Fi → 通常配信
  }

  console.log(`[Wi-Fi制限] 拒否 IP=${clientIP}`);
  res.status(403).sendFile(path.join(__dirname, 'wifi-required.html'));
}

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
app.use(express.static(__dirname));

app.listen(PORT, () => {
  const ips = [...getAllOfficeIPs()];
  console.log(`lark-portal 起動中 (port=${PORT})`);
  console.log(`登録済み拠点IP: ${ips.length > 0 ? ips.join(', ') : '未設定（/staff は全拒否）'}`);
});
