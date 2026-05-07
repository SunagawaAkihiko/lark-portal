'use strict';
// ============================================================
// lark-portal 配信サーバー
//
// 機能:
//   - 会社Wi-Fi（登録済み拠点IP）からのアクセスのみ許可する
//   - それ以外のIPからは「会社Wi-Fiに接続してください」ページを返す
//
// IP設定:
//   打刻サーバーと同じ環境変数名 SHOP_{KEY}_IP を使用する。
//   例: SHOP_A_IP=1.2.3.4  SHOP_B_IP=5.6.7.8
//   カンマ区切りで複数IPを登録可能（例: SHOP_A_IP=1.2.3.4,1.2.3.5）
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
// 登録済み拠点IP以外からのアクセスは 403 + wifi-required.html を返す
function requireOfficeWifi(req, res, next) {
  // wifi-required.html 自体は制限なしで返す（無限ループ防止）
  if (req.path === '/wifi-required.html') return next();

  const clientIP  = getClientIP(req);
  const officeIPs = getAllOfficeIPs();

  if (officeIPs.has(clientIP)) {
    return next(); // 会社Wi-Fi → 通常配信
  }

  // 会社Wi-Fi外 → アクセス拒否ページを返す
  console.log(`[Wi-Fi制限] 拒否 IP=${clientIP}`);
  res.status(403).sendFile(path.join(__dirname, 'wifi-required.html'));
}

app.use(requireOfficeWifi);
// HTMLファイルをルートディレクトリから配信する
app.use(express.static(__dirname));

app.listen(PORT, () => {
  const ips = [...getAllOfficeIPs()];
  console.log(`lark-portal 起動中 (port=${PORT})`);
  console.log(`登録済み拠点IP: ${ips.length > 0 ? ips.join(', ') : '未設定（全アクセス拒否）'}`);
});
