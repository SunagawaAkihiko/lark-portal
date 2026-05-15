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
        description: "ヘルパー記録の入力・確認",
        icon: "fa-clipboard-user",
        url: "helper-record.html"
    },
    {
        title: "入居者物品提供",
        description: "入居者へ消耗品を提供した際に使用",
        icon: "fa-box-open",
        url: "consumable-record.html"
    },
    {
        title: "消耗品注文",
        description: "",
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
        title: "レクレーション報告",
        description: "",
        icon: "fa-users",
        url: "rec-report.html"
    },
    {
        title: "入金確認",
        description: "利用料入金の登録・確認",
        icon: "fa-yen-sign",
        url: "payment-confirm.html"
    },
    {
        title: "入金管理",
        description: "未入金の確認・入金登録・領収書メール送信",
        icon: "fa-yen-sign",
        url: "payment-collection.html",
        adminOnly: true
    },
    {
        title: "お客様情報登録",
        description: "新しい利用者の基本情報・家族情報・住所等を登録します",
        icon: "fa-user-plus",
        url: "customer-register.html",
        adminOnly: true,
        selfEntry: true  // ご本人入力フォーム（お客様・入職者本人が入力）
    },
    {
        title: "スタッフ入職登録",
        description: "入職時の基本情報・住所・保有資格などを登録します",
        icon: "fa-user-tie",
        url: "staff-register.html",
        adminOnly: true,
        selfEntry: true  // ご本人入力フォーム（お客様・入職者本人が入力）
    },
    {
        title: "スタッフマイページ",
        description: "給与明細・有休残日数・出勤記録などを本人が確認できます",
        icon: "fa-id-card",
        url: "https://attendance-app-irf1.onrender.com/staff-mypage.html",
        adminOnly: true,
        selfEntry: true  // ご本人入力フォーム（スタッフ本人が使用）
    },
    {
        title: "スタッフ給与設定",
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
        title: "物品提供管理",
        description: "入居者への物品提供履歴の確認・編集と消耗品マスタの商品登録",
        icon: "fa-box-open",
        url: "supply-admin.html",
        adminOnly: true  // 管理者専用（admin.htmlでのみ表示）
    },
    {
        title: "給与・出勤管理",
        description: "給与一覧表・有休管理・出勤簿・保険料設定",
        icon: "fa-money-bill-wave",
        url: "salary-admin.html",
        adminOnly: true  // 管理者専用（admin.htmlでのみ表示）
    },
    {
        title: "シフト管理",
        description: "月次シフトの自動作成・手動調整・PDF出力",
        icon: "fa-calendar-alt",
        url: "shift.html",
        adminOnly: true  // 管理者専用（admin.htmlでのみ表示）
    },
    {
        title: "入居者情報",
        description: "入居者情報の閲覧・薬手帳の登録ができます",
        icon: "fa-address-card",
        url: "customer-info.html"
    },
    {
        title: "各種マニュアル",
        description: "業務や操作に関するマニュアル",
        icon: "fa-book",
        url: "manual.html"
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
    } else if (type === 'admin') {
        div.className = 'section-divider section-divider--admin';
        div.innerHTML = '<i class="fa-solid fa-lock"></i> 管理者専用ツール';
    } else {
        div.className = 'section-divider section-divider--self';
        div.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> ご本人入力フォーム';
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
    // 管理者専用のうち、本人入力フォームと管理者操作ツールに分ける
    const selfLinks  = portalLinks.filter(link =>  link.adminOnly &&  link.selfEntry);
    const adminLinks = portalLinks.filter(link =>  link.adminOnly && !link.selfEntry);

    if (window.ADMIN_MODE === true) {
        // 管理者モード：スタッフ帯・管理者帯・本人入力フォーム帯の3つを表示する
        grid.appendChild(createSectionDivider('staff'));
        staffLinks.forEach(link => grid.appendChild(createCard(link)));

        grid.appendChild(createSectionDivider('admin'));
        adminLinks.forEach(link => grid.appendChild(createCard(link)));

        grid.appendChild(createSectionDivider('self'));
        selfLinks.forEach(link => grid.appendChild(createCard(link)));
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
        <div class="card-text">
            <h2 class="card-title">${link.title}</h2>
            ${link.description ? `<p class="card-desc">${link.description}</p>` : ''}
        </div>
    `;
    return card;
}

// Run on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    buildDashboard();
    syncLayout();
});

// ============================================================
// レイアウト切り替え
// ============================================================
function syncLayout() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const container   = document.querySelector('.container');
    const grid        = document.getElementById('link-grid');
    if (!container || !grid) return;
    container.classList.toggle('container--landscape', isLandscape);
    grid.classList.toggle('grid--landscape', isLandscape);
}

// Android・PC: resize で確実に反映
window.addEventListener('resize', syncLayout);

// iOS Safari: 回転後も viewport の CSS 幅が portrait のまま残るバグがある。
// viewport の width を一瞬 "1" に固定 → device-width に戻すことで
// iOS に viewport を再計算させてからレイアウトを同期する。
(function () {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const BASE = 'width=device-width, initial-scale=1.0, shrink-to-fit=no, viewport-fit=cover';
    window.addEventListener('orientationchange', () => {
        // ステップ1: width=1 で viewport を強制リセット
        meta.content = 'width=1, initial-scale=1';
        // ステップ2: iOS が viewport を再計算する猶予を与えてから元に戻す
        setTimeout(() => {
            meta.content = BASE;
            // ステップ3: viewport 更新後にレイアウトを同期する
            setTimeout(syncLayout, 50);
        }, 150);
    });
}());
