const API_BASE = "https://attendance-app-irf1.onrender.com"; // 本番環境

let calendarData = [];
let customersData = []; // Larkの顧客情報
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
    await fetchCalendarData();
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
    const offices = new Set();
    data.forEach(item => { if (item.office) offices.add(item.office); });
    
    // 任意の並び順を設定
    const order = ["大浦家", "上津役家"];
    const officeArray = Array.from(offices).sort((a, b) => {
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
    inputNameSelect.innerHTML = '<option value="">選択してください</option>';
    
    if (!office) {
        inputNameSelect.innerHTML = '<option value="">先に事業所を選択してください</option>';
        inputNameText.classList.add('hidden');
        inputNameText.disabled = true;
        return;
    }

    const names = new Set();
    customersData.forEach(item => {
        // 契約が「終了」の人は除外する
        if (item.office === office && item.name && !item.status.includes('終了')) {
            names.add(item.name.trim());
        }
    });

    Array.from(names).sort().forEach(n => {
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

async function handleAddEvent(e) {
    e.preventDefault();
    
    // ダミー中のスキップ処理
    if (API_BASE.includes("localhost")) {
        alert("ダミーテスト中につき、実際の登録処理はスキップされました。デザインはOKでしょうか？");
        addModal.classList.add('hidden');
        return;
    }

    const y = document.getElementById('input-year').value;
    const m = document.getElementById('input-month').value;
    const d = document.getElementById('input-day').value;
    const dateStr = `${y}-${m}-${d}`;

    const h = document.getElementById('input-hour').value;
    const min = document.getElementById('input-minute').value;
    const timeStr = (h === '' || min === '') ? '' : `${h}:${min}`;

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
