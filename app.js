/**
 * リフォーム在庫管理アプリ PWA - Frontend Logic
 */

// 注: ここにはデプロイしたGASのWebアプリURLを入力する必要があります
const API_URL = 'https://script.google.com/macros/s/AKfycbzTmIql-mEG9YlVd8TUKUVoT8wW6r0HZKd9HFQV6HopW1nb98gtuSovt_DMQgAiJgYBQQ/exec';
// （実際にはユーザーにGASをデプロイしてもらいURLを入力してもらう想定）

// State
let inventoryData = [];
let masterData = { categories: [], locations: [] };
let selectedPhotoBase64 = null;
let currentConsumeItemId = null;

// DOM Elements
const views = document.querySelectorAll('.view');
const navItems = document.querySelectorAll('.nav-item[data-target]');
const listContainer = document.getElementById('inventory-list');
const loadingOverlay = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');

// Init
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupAddForm();
    setupSearchAndFilter();
    setupConsumeModal();

    // URLが未設定の場合は警告用モックデータを利用
    if (API_URL === 'YOUR_GAS_WEB_APP_URL') {
        alert("【開発者モード】\nバックエンドURLが未設定のため、ローカルのモックデータで動作します。セットアップ後にapp.jsのAPI_URLを設定してください。");
        loadMockData();
    } else {
        fetchInitialData();
    }

    document.getElementById('btn-sync').addEventListener('click', () => {
        if (API_URL !== 'YOUR_GAS_WEB_APP_URL') fetchInitialData();
    });
});

// --- UI / Navigation ---

function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            if (target === 'view-settings') {
                alert('設定機能は現在未実装です。（API_URLの変更UIなどをここに配置予定）');
                return;
            }

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            views.forEach(v => {
                v.classList.remove('active');
                if (v.id === target) v.classList.add('active');
            });
        });
    });
}

function showLoading(text = '読み込み中...') {
    loadingText.textContent = text;
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// --- API Communication ---

async function fetchInitialData() {
    showLoading('データを同期中...');
    try {
        const resMaster = await fetch(`${API_URL}?action=getMaster`);
        const masterJson = await resMaster.json();
        if (masterJson.success) {
            masterData = masterJson.data;
            updateSelectOptions();
        }

        const resInv = await fetch(`${API_URL}?action=getInventory`);
        const invJson = await resInv.json();
        if (invJson.success) {
            inventoryData = invJson.data;
            renderInventory();
        }
    } catch (err) {
        console.error(err);
        alert('通信エラーが発生しました。オフラインの可能性があります。');
    } finally {
        hideLoading();
    }
}

async function postData(payload, loadingMsg) {
    if (API_URL === 'YOUR_GAS_WEB_APP_URL') {
        // モック用のフェイク遅延
        showLoading(loadingMsg);
        return new Promise(resolve => {
            setTimeout(() => {
                hideLoading();
                resolve({ success: true });
            }, 1000);
        });
    }

    showLoading(loadingMsg);
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        const json = await res.json();
        return json;
    } catch (err) {
        console.error(err);
        alert('通信エラーが発生しました。');
        return { success: false, error: err };
    } finally {
        hideLoading();
    }
}

// --- List View & Render ---

function updateSelectOptions() {
    const catFilter = document.getElementById('filter-category');
    const locFilter = document.getElementById('filter-location');
    const addCat = document.getElementById('add-category');
    const addLoc = document.getElementById('add-location');

    const createOptions = (arr) => arr.map(v => `<option value="${v}">${v}</option>`).join('');

    catFilter.innerHTML = `<option value="">全カテゴリ</option>` + createOptions(masterData.categories);
    locFilter.innerHTML = `<option value="">全保管場所</option>` + createOptions(masterData.locations);

    addCat.innerHTML = createOptions(masterData.categories);
    addLoc.innerHTML = createOptions(masterData.locations);
}

function renderInventory() {
    const term = document.getElementById('search-input').value.toLowerCase();
    const cat = document.getElementById('filter-category').value;
    const loc = document.getElementById('filter-location').value;
    const sort = document.getElementById('sort-select').value;

    let filtered = inventoryData.filter(item => {
        if (item.status === 'archived') return false;
        const matchName = item.name.toLowerCase().includes(term);
        const matchCat = cat ? item.category === cat : true;
        const matchLoc = loc ? item.location === loc : true;
        return matchName && matchCat && matchLoc;
    });

    if (sort === 'qty_asc') {
        filtered.sort((a, b) => Number(a.qty) - Number(b.qty));
    } else {
        // default: updated_desc
        filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }

    listContainer.innerHTML = '';

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: var(--text-muted);">アイテムが見つかりません。</p>';
        return;
    }

    filtered.forEach(item => {
        const isWarning = item.qty <= (item.threshold || 0);
        // Use first photo or placeholder
        const photos = item.photo_urls ? item.photo_urls.split(',') : [];
        const photoHtml = photos.length > 0 && photos[0] !== ''
            ? `<img src="${photos[0]}" class="item-thumb" alt="thumb">`
            : `<div class="item-thumb placeholder"><span class="material-symbols-outlined">image</span></div>`;

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
      <div class="item-card-header">
        ${photoHtml}
        <div class="item-info">
          <h3 class="item-title">${item.name}</h3>
          <div class="item-meta">
            <span class="tag">${item.category}</span>
            <span class="tag">${item.location}</span>
          </div>
          <div class="item-stock ${isWarning ? 'warning' : ''}">
            ${item.qty} <span style="font-size:0.8rem; font-weight:normal;">${item.unit}</span>
            ${isWarning ? '<span style="font-size:0.75rem; color:var(--danger); margin-left:8px;">(要発注)</span>' : ''}
          </div>
        </div>
      </div>
      <div class="item-actions">
        <button class="action-btn btn-consume" onclick="openConsumeModal('${item.item_id}')">使用する</button>
        <button class="action-btn btn-delete" onclick="archiveItem('${item.item_id}')">削除</button>
      </div>
    `;
        listContainer.appendChild(card);
    });
}

function setupSearchAndFilter() {
    document.getElementById('search-input').addEventListener('input', renderInventory);
    document.getElementById('filter-category').addEventListener('change', renderInventory);
    document.getElementById('filter-location').addEventListener('change', renderInventory);
    document.getElementById('sort-select').addEventListener('change', renderInventory);
}

// --- Add Item ---

function setupAddForm() {
    const form = document.getElementById('add-form');
    const uploadArea = document.getElementById('photo-upload-area');
    const photoInput = document.getElementById('photo-input');
    const preview = document.getElementById('photo-preview');
    const btnClear = document.getElementById('btn-clear-photo');

    // Photo
    uploadArea.addEventListener('click', () => photoInput.click());

    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 画像圧縮とBase64エンコード
        compressImage(file, 800, 800, 0.7, (base64Str) => {
            selectedPhotoBase64 = base64Str;
            preview.src = base64Str;
            preview.classList.remove('hidden');
            btnClear.classList.remove('hidden');
        });
    });

    btnClear.addEventListener('click', () => {
        selectedPhotoBase64 = null;
        photoInput.value = '';
        preview.src = '';
        preview.classList.add('hidden');
        btnClear.classList.add('hidden');
    });

    // Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            action: 'addItem',
            name: document.getElementById('add-name').value,
            category: document.getElementById('add-category').value,
            location: document.getElementById('add-location').value,
            qty: parseInt(document.getElementById('add-qty').value, 10),
            unit: document.getElementById('add-unit').value || '個',
            strategy: document.getElementById('add-strategy').value,
            note: document.getElementById('add-note').value,
            photoBase64: selectedPhotoBase64
        };

        const res = await postData(payload, '登録しています...');
        if (res.success) {
            alert("登録しました！");
            form.reset();
            btnClear.click();
            if (API_URL !== 'YOUR_GAS_WEB_APP_URL') fetchInitialData();
            else mockLocalAdd(payload); // モック動作

            // 一覧に戻る
            navItems[0].click();
        } else {
            alert("登録に失敗しました。");
        }
    });
}

// 簡易的なクライアントサイドア画像圧縮
function compressImage(file, maxWidth, maxHeight, quality, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            let w = img.width;
            let h = img.height;
            if (w > maxWidth || h > maxHeight) {
                if (w > h) { h = Math.round((h *= maxWidth / w)); w = maxWidth; }
                else { w = Math.round((w *= maxHeight / h)); h = maxHeight; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', quality));
        };
    };
}

// --- Consume & Archive Actions ---

function setupConsumeModal() {
    const modal = document.getElementById('consume-modal');
    const btnMinus = document.getElementById('btn-consume-minus');
    const btnPlus = document.getElementById('btn-consume-plus');
    const qtyInput = document.getElementById('consume-qty');
    const btnCancel = document.getElementById('btn-consume-cancel');
    const btnSubmit = document.getElementById('btn-consume-submit');

    btnMinus.addEventListener('click', () => {
        if (qtyInput.value > 1) qtyInput.value--;
    });
    btnPlus.addEventListener('click', () => {
        qtyInput.value++;
    });
    btnCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
        currentConsumeItemId = null;
    });

    btnSubmit.addEventListener('click', async () => {
        if (!currentConsumeItemId) return;
        const qty = parseInt(qtyInput.value, 10);
        const note = document.getElementById('consume-note').value;

        const payload = {
            action: 'consumeItem',
            item_id: currentConsumeItemId,
            consume_qty: qty,
            note: note
        };

        modal.classList.add('hidden');
        const res = await postData(payload, '記録しています...');
        if (res.success) {
            if (API_URL !== 'YOUR_GAS_WEB_APP_URL') fetchInitialData();
            else mockLocalConsume(currentConsumeItemId, qty);
        }
    });
}

window.openConsumeModal = function (itemId) {
    const item = inventoryData.find(i => i.item_id === itemId);
    if (!item) return;

    currentConsumeItemId = itemId;
    document.getElementById('consume-item-name').textContent = item.name;
    document.getElementById('consume-current-qty').textContent = `${item.qty} ${item.unit}`;
    document.getElementById('consume-qty').value = 1;
    document.getElementById('consume-note').value = '';
    document.getElementById('consume-modal').classList.remove('hidden');
}

window.archiveItem = async function (itemId) {
    const item = inventoryData.find(i => i.item_id === itemId);
    if (!confirm(`「${item.name}」をアーカイブ（一覧から削除）しますか？`)) return;

    const payload = { action: 'archiveItem', item_id: itemId };
    const res = await postData(payload, '削除しています...');
    if (res.success) {
        if (API_URL !== 'YOUR_GAS_WEB_APP_URL') fetchInitialData();
        else {
            item.status = 'archived';
            renderInventory();
        }
    }
}

// --- Mock Data support for visualization before GAS is linked ---
function loadMockData() {
    masterData = {
        categories: ['給湯器', '配管部材', '電材', '木材'],
        locations: ['倉庫A', '車両1', '現場']
    };
    inventoryData = [
        { item_id: 'mock1', name: 'ピュアレストQR', category: '配管部材', location: '倉庫A', qty: 10, unit: '台', status: 'active', updated_at: new Date().toISOString() },
        { item_id: 'mock2', name: 'VVFケーブル 2.0-3C', category: '電材', location: '車両1', qty: 2, unit: '巻', status: 'active', threshold: 5, updated_at: new Date().toISOString() }
    ];
    updateSelectOptions();
    renderInventory();
}

function mockLocalAdd(payload) {
    if (payload.strategy === 'add') {
        const existing = inventoryData.find(i => i.name === payload.name && i.location === payload.location);
        if (existing) {
            existing.qty += payload.qty;
            renderInventory();
            return;
        }
    }
    inventoryData.push({
        item_id: 'mock' + Date.now(),
        name: payload.name, category: payload.category, location: payload.location,
        qty: payload.qty, unit: payload.unit, status: 'active', updated_at: new Date().toISOString()
    });
    renderInventory();
}

function mockLocalConsume(id, qty) {
    const item = inventoryData.find(i => i.item_id === id);
    if (item) {
        item.qty = Math.max(0, item.qty - qty);
        if (item.qty === 0) item.status = 'out';
    }
    renderInventory();
}
