// URLがローカル(localhost, 127.0.0.1) または ファイルプロトコル(file://) の場合はローカルのNodeサーバーを参照する
const isLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.protocol === 'file:';

const API_BASE = isLocal
    ? "http://localhost:3000"
    : "https://attendance-app-irf1.onrender.com";

let calendarData = [];
let customersData = []; // Larkの顧客情報
let fieldOptions = {}; // カレンダーテーブルのフィールド選択肢（Larkの正確な選択肢名を保持する）
let currentOfficeFilter = "";

let currentDate = new Date(); // 現在表示中の月（カレンダー用）
let selectedDate = new Date(); // 現在選択中の日（上部リスト用）

// DOM要素
const mainContent = document.getElementById('main-content');
const loading = document.getElementById('loading');
const officeTabs = document.getElementById('office-tabs');

const addEventFab = document.getElementById('add-event-fab');
const addModal = document.getElementById('add-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const addEventForm = document.getElementById('add-event-form');
const inputOffice = document.getElementById('input-office');
const inputNameSelect = document.getElementById('input-name-select');

// 削除モーダル関連のDOM要素
const deleteEventFab = document.getElementById('delete-event-fab');
const deleteModal = document.getElementById('delete-modal');
const closeDeleteModalBtn = document.getElementById('close-delete-modal-btn');
const deleteEventList = document.getElementById('delete-event-list');
const deleteModalDateLabel = document.getElementById('delete-modal-date-label');

const calendarDays = document.getElementById('calendar-days');
const currentMonthTitle = document.getElementById('current-month-title');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

const selectedDateTitle = document.getElementById('selected-date-title');
const selectedDayEvents = document.getElementById('selected-day-events');

document.addEventListener('DOMContentLoaded', () => {
    initDateTimeSelectors();

    addEventFab.addEventListener('click', () => addModal.classList.remove('hidden'));
    closeModalBtn.addEventListener('click', () => addModal.classList.add('hidden'));
    addEventForm.addEventListener('submit', handleAddEvent);

    // 削除FABクリック → 選択中の日付のイベントリストを削除モーダルに表示する
    deleteEventFab.addEventListener('click', openDeleteModal);
    closeDeleteModalBtn.addEventListener('click', () => deleteModal.classList.add('hidden'));

    prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    nextMonthBtn.addEventListener('click', () => changeMonth(1));

    // 事業所が選ばれたら利用者名リストを切り替える
    inputOffice.addEventListener('change', (e) => {
        updateNameSelectOptions(e.target.value);
    });

    // 事業所変更時だけでなく、初期設定時にも動作可能に
    fetchInitialData();
});

function getTodayYMD() {
    const today = new Date();
    return formatYMD(today);
}

function formatYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function fetchInitialData() {
    await fetchCustomersData();
    await fetchFieldOptions();
    await fetchCalendarData();
}

// Larkのフィールド定義APIから単一選択の選択肢を取得し、フォームに動的反映する
// 取得した選択肢はglobalのfieldOptionsに保持し、氏名フォームの生成にも利用する
async function fetchFieldOptions() {
    try {
        const res = await fetch(`${API_BASE}/api/calendar/fields`);
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data || {};

        // グローバル変数に保存（updateNameSelectOptionsで参照するため）
        fieldOptions = data;

        // 「予定選択」の選択肢を動的に生成する
        const typeSelect = document.getElementById('input-type');
        if (data['予定選択'] && typeSelect) {
            typeSelect.innerHTML = '<option value="">選択してください</option>';
            data['予定選択'].forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                typeSelect.appendChild(opt);
            });
        }

        // 「予定時間」の選択肢を動的に生成する
        const hourSelect = document.getElementById('input-hour');
        const minuteSelect = document.getElementById('input-minute');
        if (data['予定時間'] && hourSelect) {
            // 既存の選択肢をクリアして再生成する
            hourSelect.innerHTML = '';
            minuteSelect.innerHTML = '';

            data['予定時間'].forEach(name => {
                const opt = document.createElement('option');
                // 「未定」は空値、それ以外はそのまま値にする
                opt.value = name === '未定' ? '' : name;
                opt.textContent = name;
                hourSelect.appendChild(opt);
            });

            // 分セレクトは使わないので非表示にする（時間は予定時間の1セレクトで完結）
            minuteSelect.style.display = 'none';
            const dtLabel = minuteSelect.nextElementSibling;
            if (dtLabel) dtLabel.style.display = 'none';
        }
    } catch(e) {
        console.warn('[fetchFieldOptions] 選択肢の取得に失敗しました（フォールバックを使用）:', e);
    }
}

async function fetchCustomersData() {
    if (API_BASE.includes("localhost")) {
        customersData = [
            { id: 101, office: "大浦家", name: "山田 太郎", status: "" },
            { id: 102, office: "大浦家", name: "佐藤 健", status: "" },
            { id: 103, office: "大浦家", name: "高橋 メアリー", status: "" },
            { id: 104, office: "上津役家", name: "鈴木 花子", status: "" },
            { id: 105, office: "上津役家", name: "田中 恵", status: "" },
            { id: 106, office: "上津役家", name: "伊藤 博", status: "終了" } // 不要
        ];
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/customers/get`);
        if(res.ok) {
            const json = await res.json();
            customersData = json.data || [];
        }
    } catch(e) {
        console.error("顧客リスト取得に失敗:", e);
    }
}

async function fetchCalendarData() {
    try {
        const res = await fetch(`${API_BASE}/api/calendar/get`);
        if (!res.ok) throw new Error("予定データの取得に失敗しました");
        const json = await res.json();
        calendarData = json.data || [];
    } catch (err) {
        console.error("カレンダー取得エラー:", err);
        calendarData = [];
    }
    
    // 事業所タブは、顧客データ（マスター）から構築する
    extractOffices(customersData);
    
    // 画面の描画
    renderMonthlyCalendar();
    renderSelectedDay();

    loading.classList.add('hidden');
    mainContent.classList.remove('hidden');
}

function extractOffices(data) {
    // 顧客マスターから事業所名を抽出する（スペース除去して比較用）
    const customerOffices = new Set();
    data.forEach(item => { if (item.office) customerOffices.add(item.office.trim()); });

    // カレンダーテーブルの「事業所」Lark選択肢が取得済みであれば優先して使用する
    // これにより inputOffice の value が必ずLarkの正確な選択肢文字列になる
    const calendarOfficeOptions = fieldOptions['事業所'] || [];
    let officeArray;
    if (calendarOfficeOptions.length > 0) {
        // Lark選択肢の中で顧客マスターにも存在する事業所のみ表示する
        officeArray = calendarOfficeOptions.filter(calOff =>
            Array.from(customerOffices).some(custOff =>
                custOff.replace(/\s/g, '') === calOff.replace(/\s/g, '')
            )
        );
        // Lark選択肢にない事業所も顧客マスターにあれば追加する（念のため）
        customerOffices.forEach(custOff => {
            if (!officeArray.some(o => o.replace(/\s/g, '') === custOff.replace(/\s/g, ''))) {
                officeArray.push(custOff);
            }
        });
    } else {
        // フォールバック：顧客データの事業所名をそのまま使用する
        officeArray = Array.from(customerOffices);
    }

    // 任意の並び順を設定
    const order = ["大浦家", "上津役家"];
    officeArray.sort((a, b) => {
        let idxA = order.indexOf(a);
        let idxB = order.indexOf(b);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
    });

    officeTabs.innerHTML = '';
    inputOffice.innerHTML = '<option value="">選択してください</option>';

    // 初期選択を最初の事業所に
    if (officeArray.length > 0 && !currentOfficeFilter) {
        currentOfficeFilter = officeArray[0];
    }

    officeArray.forEach(off => {
        const btn = document.createElement('button');
        btn.className = 'office-tab';
        if (currentOfficeFilter === off) btn.classList.add('active');
        btn.dataset.office = off;
        btn.textContent = off;
        officeTabs.appendChild(btn);

        const option = document.createElement('option');
        option.value = off; option.textContent = off;
        inputOffice.appendChild(option);
    });

    officeTabs.querySelectorAll('.office-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            officeTabs.querySelectorAll('.office-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            currentOfficeFilter = e.target.dataset.office;
            renderMonthlyCalendar();
            renderSelectedDay();
        });
    });
}

function updateNameSelectOptions(office) {
    if (!office) {
        inputNameSelect.innerHTML = '<option value="">先に事業所を選択してください</option>';
        return;
    }

    inputNameSelect.innerHTML = '<option value="">選択してください</option>';

    // カレンダーテーブルの「氏名」単一選択オプション（Larkの正確な文字列）
    // これを使わないと SingleSelectFieldConvFail (code=1254062) が発生する
    const calendarNames = fieldOptions['氏名'] || [];

    // 顧客マスターから対象事業所・契約中の利用者名を取得する（スペース除去して比較用に使う）
    const customerNamesInOffice = new Set();
    customersData.forEach(item => {
        if (item.office === office && item.name && !item.status.includes('終了')) {
            customerNamesInOffice.add(item.name.trim().replace(/\s/g, ''));
        }
    });

    let namesToShow;
    if (calendarNames.length > 0) {
        // カレンダー選択肢を優先：顧客マスターの該当事業所に存在する名前のみ表示する
        // スペースを無視して突き合わせることで表記ゆれ（半角スペース等）を吸収する
        namesToShow = calendarNames.filter(calName => {
            return customerNamesInOffice.has(calName.replace(/\s/g, ''));
        });
    } else {
        // fieldOptionsが未取得の場合はフォールバックとして顧客データをそのまま使用する
        namesToShow = Array.from(customerNamesInOffice).sort();
    }

    namesToShow.sort().forEach(n => {
        const opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        inputNameSelect.appendChild(opt);
    });
}

function initDateTimeSelectors() {
    const ySel = document.getElementById('input-year');
    const mSel = document.getElementById('input-month');
    const dSel = document.getElementById('input-day');
    const hSel = document.getElementById('input-hour');
    const minSel = document.getElementById('input-minute');

    const now = new Date();
    const curYear = now.getFullYear();

    // Year (現在〜2年後)
    for(let y = curYear - 1; y <= curYear + 2; y++) {
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y;
        ySel.appendChild(opt);
    }
    ySel.value = curYear;

    // Month
    for(let m = 1; m <= 12; m++) {
        const val = String(m).padStart(2, '0');
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val;
        mSel.appendChild(opt);
    }
    mSel.value = String(now.getMonth() + 1).padStart(2, '0');

    // Day Updater
    const updateDays = () => {
        const year = parseInt(ySel.value);
        const month = parseInt(mSel.value);
        const daysInMonth = new Date(year, month, 0).getDate();
        
        const currentSelectedDay = dSel.value;
        dSel.innerHTML = '';
        for(let d = 1; d <= daysInMonth; d++) {
            const val = String(d).padStart(2, '0');
            const opt = document.createElement('option');
            opt.value = val; opt.textContent = val;
            dSel.appendChild(opt);
        }
        
        if (currentSelectedDay && parseInt(currentSelectedDay) <= daysInMonth) {
            dSel.value = currentSelectedDay;
        } else if (!currentSelectedDay) {
            dSel.value = String(now.getDate()).padStart(2, '0');
        } else {
            dSel.value = String(daysInMonth).padStart(2, '0');
        }
    };

    ySel.addEventListener('change', updateDays);
    mSel.addEventListener('change', updateDays);
    updateDays(); // 初回実行

    // Hour
    const hSelMitei = document.createElement('option');
    hSelMitei.value = ''; hSelMitei.textContent = '未定';
    hSel.appendChild(hSelMitei);

    for(let h = 0; h <= 23; h++) {
        const val = String(h).padStart(2, '0');
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val;
        hSel.appendChild(opt);
    }
    hSel.value = String(now.getHours()).padStart(2, '0');

    // Minute (5分刻み)
    const mSelMitei = document.createElement('option');
    mSelMitei.value = ''; mSelMitei.textContent = '--';
    minSel.appendChild(mSelMitei);

    for(let m = 0; m < 60; m += 5) {
        const val = String(m).padStart(2, '0');
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = val;
        minSel.appendChild(opt);
    }
    let mSnap = Math.round(now.getMinutes() / 5) * 5;
    if (mSnap === 60) mSnap = 55;
    minSel.value = String(mSnap).padStart(2, '0');

    // 「時」が未定なら「分」を「--」にして操作不可にする
    const updateTimeSync = () => {
        if (hSel.value === '') {
            minSel.value = '';
            minSel.disabled = true;
        } else {
            minSel.disabled = false;
            if (minSel.value === '') {
                minSel.value = '00';
            }
        }
    };
    hSel.addEventListener('change', updateTimeSync);
    updateTimeSync(); // 初期化時に実行
}

function changeMonth(offset) {
    currentDate.setMonth(currentDate.getMonth() + offset);
    renderMonthlyCalendar();
}

function getFilteredData() {
    return calendarData.filter(item => item.office === currentOfficeFilter);
}

// 1ヶ月カレンダーの描画
function renderMonthlyCalendar() {
    calendarDays.innerHTML = '';
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    
    currentMonthTitle.textContent = `${y}年 ${m + 1}月`;

    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const startPadding = firstDay.getDay(); // 0(Sun) - 6(Sat)
    const daysInMonth = lastDay.getDate();

    const filtered = getFilteredData();
    const eventCountsByDate = {};
    filtered.forEach(ev => {
        if(ev.date) {
            eventCountsByDate[ev.date] = (eventCountsByDate[ev.date] || 0) + 1;
        }
    });

    const todayStr = getTodayYMD();
    const selectedStr = formatYMD(selectedDate);

    // 前の空白
    for (let i = 0; i < startPadding; i++) {
        const d = document.createElement('div');
        d.className = 'day-cell other-month';
        calendarDays.appendChild(d);
    }

    // 当月の日
    for (let i = 1; i <= daysInMonth; i++) {
        const cellDate = new Date(y, m, i);
        const cellDateStr = formatYMD(cellDate);
        
        const d = document.createElement('div');
        d.className = 'day-cell';
        if (cellDateStr === todayStr) d.classList.add('today');
        if (cellDateStr === selectedStr) d.classList.add('selected');

        d.innerHTML = `<span>${i}</span>`;

        // ドットの描画
        const count = eventCountsByDate[cellDateStr] || 0;
        if (count > 0) {
            const indContainer = document.createElement('div');
            indContainer.className = 'indicators';
            const dot = document.createElement('div');
            dot.className = count > 1 ? 'dot multi' : 'dot';
            indContainer.appendChild(dot);
            d.appendChild(indContainer);
        }

        d.addEventListener('click', () => {
            selectedDate = cellDate;
            renderMonthlyCalendar();
            renderSelectedDay();
        });

        calendarDays.appendChild(d);
    }

    // 後ろの空白
    const totalCells = startPadding + daysInMonth;
    const endPadding = Math.ceil(totalCells / 7) * 7 - totalCells;
    for (let i = 0; i < endPadding; i++) {
         const d = document.createElement('div');
         d.className = 'day-cell other-month';
         calendarDays.appendChild(d);
    }
}

// 選択された日の予定リストの描画
function renderSelectedDay() {
    selectedDayEvents.innerHTML = '';
    const dateStr = formatYMD(selectedDate);
    
    // タイトルの設定
    if (dateStr === getTodayYMD()) {
        selectedDateTitle.innerHTML = `今日の予定 <span style="font-size:1.15rem; color:var(--primary-color); font-weight:bold; margin-left:0.5rem;">${dateStr.replace(/-/g, '/')}</span>`;
    } else {
        selectedDateTitle.innerHTML = `<span style="font-size:1.15rem; color:var(--primary-color); font-weight:bold; margin-right:0.5rem;">${dateStr.replace(/-/g, '/')}</span> の予定`;
    }

    // フィルタリング
    const filtered = getFilteredData().filter(item => item.date === dateStr);
    const sorted = filtered.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    if (sorted.length === 0) {
        selectedDayEvents.innerHTML = `<div class="no-events">予定はありません</div>`;
        return;
    }

    sorted.forEach(ev => {
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
            <div class="event-time">${ev.time || "未定"}</div>
            <div class="event-details">
                <h4>${ev.name || "名称なし"}</h4>
                <p><span class="office-tag">${ev.office || "未指定"}</span> ${ev.memo || ""}</p>
            </div>
        `;
        selectedDayEvents.appendChild(card);
    });
}

// 削除モーダルを開き、選択中の日付・事業所の予定一覧を表示する
function openDeleteModal() {
    const dateStr = formatYMD(selectedDate);
    const formatted = dateStr.replace(/-/g, '/');
    deleteModalDateLabel.textContent = `${formatted} の予定（${currentOfficeFilter}）`;

    // 選択中の日付＋事業所でフィルタリングして表示する
    const filtered = getFilteredData().filter(item => item.date === dateStr);
    const sorted = filtered.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    deleteEventList.innerHTML = '';

    if (sorted.length === 0) {
        deleteEventList.innerHTML = `<div class="no-delete-events">この日の予定はありません</div>`;
    } else {
        sorted.forEach(ev => {
            const item = document.createElement('div');
            item.className = 'delete-event-item';
            item.innerHTML = `
                <div class="delete-event-item-info">
                    <div class="ev-time">${ev.time || "未定"}</div>
                    <div class="ev-name">${ev.name || "名称なし"}</div>
                    <div class="ev-type">${ev.type || ""} ${ev.memo ? '／' + ev.memo : ''}</div>
                </div>
                <button class="delete-item-btn" data-id="${ev.id}">
                    <i class="fa-solid fa-trash"></i> 削除
                </button>
            `;
            // 削除ボタンにイベントを付与する
            item.querySelector('.delete-item-btn').addEventListener('click', () => {
                handleDeleteEvent(ev.id, ev.name, ev.time, item);
            });
            deleteEventList.appendChild(item);
        });
    }

    deleteModal.classList.remove('hidden');
}

// 指定されたレコードIDの予定をLark APIから削除する
async function handleDeleteEvent(recordId, name, time, itemEl) {
    const label = `${name || "この予定"}（${time || "未定"}）`;
    if (!confirm(`「${label}」を削除しますか？`)) return;

    // ボタンを無効化してダブルタップを防ぐ
    const btn = itemEl.querySelector('.delete-item-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const res = await fetch(`${API_BASE}/api/calendar/delete/${recordId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error("削除リクエスト失敗");
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "削除失敗");

        // 削除成功 → カードをフェードアウトして除去する
        itemEl.style.transition = 'opacity 0.3s';
        itemEl.style.opacity = '0';
        setTimeout(() => itemEl.remove(), 300);

        // 予定データを再取得して画面を更新する
        loading.classList.remove('hidden');
        mainContent.classList.add('hidden');
        deleteModal.classList.add('hidden');
        fetchCalendarData();

    } catch(err) {
        alert('削除に失敗しました: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-trash"></i> 削除';
    }
}

async function handleAddEvent(e) {
    e.preventDefault();
    
    const y = document.getElementById('input-year').value;
    const m = document.getElementById('input-month').value;
    const d = document.getElementById('input-day').value;
    const dateStr = `${y}-${m}-${d}`;

    // 予定時間はLarkのフィールド定義から動的生成した1セレクト（HH:MM形式または空）
    const timeStr = document.getElementById('input-hour').value || '';

    const payload = {
        date: dateStr,
        office: document.getElementById('input-office').value,
        name: inputNameSelect.value,
        time: timeStr,
        type: document.getElementById('input-type').value,
        memo: document.getElementById('input-memo').value
    };

    const submitBtn = document.getElementById('submit-event-btn');
    const submitLoading = document.getElementById('submit-loading');

    submitBtn.classList.add('hidden');
    submitLoading.classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/api/calendar/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("登録エラー発生");
        
        alert("予定を登録しました！");
        addModal.classList.add('hidden');
        
        // リセット
        inputNameSelect.value = '';
        document.getElementById('input-type').value = '';
        document.getElementById('input-memo').value = '';
        
        // 再読み込み
        loading.classList.remove('hidden');
        mainContent.classList.add('hidden');
        fetchCalendarData();

    } catch (err) {
        alert("登録に失敗しました: " + err.message);
    } finally {
        submitBtn.classList.remove('hidden');
        submitLoading.classList.add('hidden');
    }
}
