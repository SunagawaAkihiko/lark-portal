/**
 * Lark Portal Configuration
 *
 * Here you can easily change the titles, descriptions, icons, and URLs.
 * Icons are using FontAwesome free solid icons. 
 * You can find more icons here: https://fontawesome.com/search?o=r&m=free&s=solid
 */

const portalLinks = [
    {
        title: "予定カレンダー",
        description: "本日の予定確認とスケジュールの新規登録",
        icon: "fa-calendar-days",
        url: "calendar.html"
    },
    {
        title: "各種データ",
        description: "バイタル、体重、排便、食事摂取量、水分摂取量などのデータ閲覧・登録を行います",
        icon: "fa-database",
        url: "care-record.html"
    },
    {
        title: "ヘルパー記録",
        description: "ヘルパーの活動記録を入力・確認します",
        icon: "fa-clipboard-user",
        url: "https://ejprp394joad.jp.larksuite.com/app/VWcEbeUY8aUcxps3QH8jBm6Op4g?pageId=pgendY8NmFDDgyb5"
    },
    {
        title: "消耗品提供",
        description: "入居者へ消耗品を提供した際に使用",
        icon: "fa-box-open",
        url: "consumable-record.html"
    },
    {
        title: "消耗品発注",
        description: "消耗品の発注登録（大浦・上津役共通）",
        icon: "fa-cart-shopping",
        url: "consumable-order.html"
    },
    {
        title: "物品購入申請",
        description: "新しい物品の購入を提案・申請します",
        icon: "fa-file-invoice-dollar",
        url: "purchase-request.html"
    },
    {
        title: "レク報告",
        description: "レクリエーションの報告",
        icon: "fa-users",
        url: "rec-report.html"
    },
    {
        title: "登録ボタン一覧",
        description: "登録関連のボタンへのリンク集です",
        icon: "fa-layer-group",
        url: "https://ejprp394joad.jp.larksuite.com/app/VWcEbeUY8aUcxps3QH8jBm6Op4g?pageId=pgeg9Ui3Wm1gTZod"
    },
    {
        title: "入金確認",
        description: "利用料入金の登録・確認",
        icon: "fa-yen-sign",
        url: "payment-confirm.html"
    },
    {
        title: "新規顧客登録",
        description: "新しい利用者の基本情報・家族情報・住所等を登録します",
        icon: "fa-user-plus",
        url: "customer-register.html",
        adminOnly: true  // 管理者専用（admin.htmlでのみ表示）
    },
    {
        title: "スタッフ入職登録",
        description: "入職時の基本情報・住所・保有資格などを登録します",
        icon: "fa-user-tie",
        url: "staff-register.html",
        adminOnly: true  // 管理者専用（admin.htmlでのみ表示）
    },
    {
        title: "スタッフ勤務情報設定",
        description: "入職スタッフの雇用形態・手当・シフト・給与情報を設定します",
        icon: "fa-user-gear",
        url: "staff-admin-edit.html",
        adminOnly: true  // 管理者専用（admin.htmlでのみ表示）
    },
    {
        title: "顧客別作業設定",
        description: "事業所別の時間割を確認しながら顧客のサービス登録・管理を行います",
        icon: "fa-calendar-check",
        url: "service-schedule.html",
        adminOnly: true  // 管理者専用（admin.htmlでのみ表示）
    },
    {
        title: "利用者情報",
        description: "利用者情報の閲覧・薬手帳の登録ができます",
        icon: "fa-address-card",
        url: "customer-info.html"
    },
    {
        title: "各種マニュアル",
        description: "業務や操作に関するマニュアル",
        icon: "fa-book",
        url: "https://ejprp394joad.jp.larksuite.com/app/RsCCbm6nSaLgy0sKOkWjgzE1pkb?pageId=pgeBU1mbnZ9tp592"
    }
];

// ============================================================
// セクション見出し帯を生成して返す関数
// type: 'staff'（スタッフ共通）または 'admin'（管理者専用）
// ============================================================
function createSectionDivider(type) {
    const div = document.createElement('div');
    if (type === 'staff') {
        div.className = 'section-divider section-divider--staff';
        div.innerHTML = '<i class="fa-solid fa-users"></i> スタッフ共通ツール';
    } else {
        div.className = 'section-divider section-divider--admin';
        div.innerHTML = '<i class="fa-solid fa-lock"></i> 管理者専用ツール';
    }
    return div;
}

// ============================================================
// ダッシュボードUI初期化
// ADMIN_MODE が true（admin.html）の場合：
//   「スタッフ共通ツール」見出し → スタッフ向けカード群
//   「管理者専用ツール」見出し  → 管理者専用カード群
// ADMIN_MODE が false（index.html）の場合：
//   スタッフ向けカードのみ表示（見出しなし）
// ============================================================
function buildDashboard() {
    const grid = document.getElementById('link-grid');

    // 重複防止のためグリッドを初期化
    grid.innerHTML = '';

    const staffLinks = portalLinks.filter(link => !link.adminOnly);
    const adminLinks = portalLinks.filter(link =>  link.adminOnly);

    if (window.ADMIN_MODE === true) {
        // 管理者モード：スタッフ帯・管理者帯の両方を表示する
        grid.appendChild(createSectionDivider('staff'));
        staffLinks.forEach(link => grid.appendChild(createCard(link)));

        grid.appendChild(createSectionDivider('admin'));
        adminLinks.forEach(link => grid.appendChild(createCard(link)));
    } else {
        // スタッフモード：スタッフ向けカードのみ表示（見出しなし）
        staffLinks.forEach(link => grid.appendChild(createCard(link)));
    }
}

// ============================================================
// カードのアンカー要素を生成して返す関数
// ============================================================
function createCard(link) {
    const card = document.createElement('a');
    card.className = 'card';
    // 管理者モード（admin.html）からのリンクには ?mode=admin を付与して
    // 遷移先ページで管理者権限を識別できるようにする
    const url = window.ADMIN_MODE && link.url.endsWith('.html')
        ? link.url + '?mode=admin'
        : link.url;
    card.href = url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.innerHTML = `
        <div class="card-icon">
            <i class="fa-solid ${link.icon}"></i>
        </div>
        <h2 class="card-title">${link.title}</h2>
        <p class="card-desc">${link.description}</p>
    `;
    return card;
}

// Run on DOM loaded
document.addEventListener('DOMContentLoaded', buildDashboard);
