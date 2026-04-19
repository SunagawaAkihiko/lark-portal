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
        url: "https://ejprp394joad.jp.larksuite.com/app/VWcEbeUY8aUcxps3QH8jBm6Op4g?pageId=pgebT5SdABbf312t"
    },
    {
        title: "【大浦】消耗品発注",
        description: "大浦での消耗品の発注・確認処理を行います",
        icon: "fa-cart-shopping",
        url: "https://ejprp394joad.jp.larksuite.com/app/VWcEbeUY8aUcxps3QH8jBm6Op4g?pageId=pgeLY5YLshKno5JW"
    },
    {
        title: "【上津役】消耗品発注",
        description: "上津役での消耗品の発注・確認処理を行います",
        icon: "fa-cart-plus",
        url: "https://ejprp394joad.jp.larksuite.com/app/VWcEbeUY8aUcxps3QH8jBm6Op4g?pageId=pgeW03l9yB6mxM7l"
    },
    {
        title: "物品購入申請",
        description: "新しい物品の購入を提案・申請します",
        icon: "fa-file-invoice-dollar",
        url: "https://ejprp394joad.jp.larksuite.com/app/VWcEbeUY8aUcxps3QH8jBm6Op4g?pageId=pgejDtWnJJCy6txS"
    },
    {
        title: "レク報告",
        description: "レクリエーションの報告",
        icon: "fa-users",
        url: "https://ejprp394joad.jp.larksuite.com/app/VWcEbeUY8aUcxps3QH8jBm6Op4g?pageId=pgez78XnMNJq1dsE"
    },
    {
        title: "薬手帳登録",
        description: "お薬手帳のデータを登録",
        icon: "fa-pills",
        url: "https://ejprp394joad.jp.larksuite.com/app/VWcEbeUY8aUcxps3QH8jBm6Op4g?pageId=pgeoDQkSyq4tgibm"
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
        url: "https://ejprp394joad.jp.larksuite.com/app/VWcEbeUY8aUcxps3QH8jBm6Op4g?pageId=pgeK1XX36156LOSx"
    },
    {
        title: "新規顧客登録",
        description: "新しい利用者の基本情報・家族情報・住所等を登録します",
        icon: "fa-user-plus",
        url: "customer-register.html"
    },
    {
        title: "利用者情報",
        description: "利用者の基本情報や詳細なデータを閲覧できます",
        icon: "fa-address-card",
        url: "https://ejprp394joad.jp.larksuite.com/app/E9sJbXoLmaqpTusfzeVjTdqVpRd?pageId=pge5TTlTrwAWssp8"
    },
    {
        title: "各種マニュアル",
        description: "業務や操作に関するマニュアル",
        icon: "fa-book",
        url: "https://ejprp394joad.jp.larksuite.com/app/RsCCbm6nSaLgy0sKOkWjgzE1pkb?pageId=pgeBU1mbnZ9tp592"
    }
];

// Initialize UI
function buildDashboard() {
    const grid = document.getElementById('link-grid');
    
    // Clear the grid to avoid duplicates if re-running
    grid.innerHTML = '';

    portalLinks.forEach(link => {
        // Create card anchor element
        const card = document.createElement('a');
        card.className = 'card';
        card.href = link.url;
        card.target = "_blank"; // Open in new tab
        card.rel = "noopener noreferrer";
        
        // Build card HTML content
        card.innerHTML = `
            <div class="card-icon">
                <i class="fa-solid ${link.icon}"></i>
            </div>
            <h2 class="card-title">${link.title}</h2>
            <p class="card-desc">${link.description}</p>
        `;
        
        // Append entry
        grid.appendChild(card);
    });
}

// Run on DOM loaded
document.addEventListener('DOMContentLoaded', buildDashboard);
