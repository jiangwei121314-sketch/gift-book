/**
 * 主入口 - 应用状态管理 + 页面路由 + 事件绑定
 */

const AppState = {
  books: [],
  editingBookId: null,
  editingRecIndex: null,
  editingBookIdForModal: null, // 编辑账本时的 ID
};

/** 保存并刷新 */
async function saveAndRefresh() {
  await saveAllBooks(AppState.books);
  await saveConfig('lastUpdated', Date.now());
}

/** 切换页面 */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');

  // 更新返回按钮文字
  if (pageId === 'page-book') {
    const backBtn = document.getElementById('btn-book-back');
    backBtn.innerHTML = BookState.flipFrom === 'person' ? '&#8249; 搜索' : '&#8249;';
  }
}

/** 打开弹窗 */
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

/** 关闭弹窗 */
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

/** 显示 Toast */
function showToast(msg, duration) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration || 2000);
}

/** 初始化封面选择器 */
function initCoverPicker() {
  const picker = document.getElementById('cover-picker');
  picker.innerHTML = Object.entries(COVER_COLORS).map(([key, color]) => `
    <div class="cover-option${key === 'red' ? ' selected' : ''}"
         data-cover="${key}"
         style="background:${color}"
         title="${COVER_NAMES[key]}"></div>
  `).join('');

  picker.querySelectorAll('.cover-option').forEach(opt => {
    opt.addEventListener('click', () => {
      picker.querySelectorAll('.cover-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
}

/** 获取选中的封面颜色 */
function getSelectedCover() {
  const selected = document.querySelector('.cover-option.selected');
  return selected ? selected.dataset.cover : 'red';
}

/** 初始化收支切换 */
function initIoToggle() {
  document.querySelectorAll('.io-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.io-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

/** 获取选中的收支类型 */
function getSelectedIo() {
  const active = document.querySelector('.io-btn.active');
  return active ? active.dataset.io : '收入';
}

/** 绑定所有事件 */
function bindEvents() {
  // ---- 书架页 ----
  document.getElementById('btn-search').addEventListener('click', () => {
    showPage('page-search');
    document.getElementById('search-input').focus();
  });

  document.getElementById('btn-add-book').addEventListener('click', () => {
    AppState.editingBookIdForModal = null;
    document.getElementById('modal-book-title').textContent = '添加账本';
    document.getElementById('input-book-title').value = '';
    document.getElementById('input-book-category').value = '';
    document.getElementById('input-book-date').value = '';
    document.getElementById('input-book-note').value = '';
    // 重置封面选择
    document.querySelectorAll('.cover-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.cover === 'red');
    });
    openModal('modal-book');
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    openModal('modal-settings');
  });

  // ---- 翻书页 ----
  document.getElementById('btn-book-back').addEventListener('click', () => {
    if (BookState.flipFrom === 'person') {
      showPage('page-search');
    } else {
      renderShelf();
      showPage('page-shelf');
    }
  });

  document.getElementById('btn-prev-page').addEventListener('click', () => flipPage(-1));
  document.getElementById('btn-next-page').addEventListener('click', () => flipPage(1));

  document.getElementById('btn-add-record').addEventListener('click', () => {
    AppState.editingRecIndex = null;
    document.getElementById('modal-record-title').textContent = '添加记录';
    document.getElementById('input-rec-name').value = '';
    document.getElementById('input-rec-amount').value = '';
    document.getElementById('input-rec-date').value = '';
    document.getElementById('input-rec-note').value = '';
    document.querySelectorAll('.io-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.io === '收入');
    });
    openModal('modal-record');
  });

  // ---- 搜索页 ----
  document.getElementById('btn-search-back').addEventListener('click', () => {
    renderShelf();
    showPage('page-shelf');
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    performSearch(e.target.value);
  });

  document.getElementById('btn-search-clear').addEventListener('click', () => {
    document.getElementById('search-input').value = '';
    performSearch('');
    document.getElementById('search-input').focus();
  });

  // ---- 账本弹窗 ----
  document.getElementById('btn-book-cancel').addEventListener('click', () => {
    closeModal('modal-book');
  });

  document.getElementById('btn-book-save').addEventListener('click', async () => {
    const title = document.getElementById('input-book-title').value.trim();
    if (!title) { showToast('请输入账本名称'); return; }

    const category = document.getElementById('input-book-category').value.trim();
    const date = document.getElementById('input-book-date').value.trim();
    const note = document.getElementById('input-book-note').value.trim();
    const cover = getSelectedCover();

    if (AppState.editingBookIdForModal) {
      // 编辑
      const book = AppState.books.find(b => b.id === AppState.editingBookIdForModal);
      if (book) {
        book.title = title;
        book.category = category;
        book.event_date = date;
        book.note = note;
        book.cover = cover;
      }
    } else {
      // 新建
      AppState.books.push(createBook(title, category, date, cover, note));
    }

    await saveAndRefresh();
    closeModal('modal-book');
    renderShelf();
    showToast(AppState.editingBookIdForModal ? '已更新' : '已创建');
  });

  // ---- 记录弹窗 ----
  document.getElementById('btn-rec-cancel').addEventListener('click', () => {
    closeModal('modal-record');
  });

  document.getElementById('btn-rec-save').addEventListener('click', async () => {
    const name = document.getElementById('input-rec-name').value.trim();
    const amountStr = document.getElementById('input-rec-amount').value.trim();
    const date = document.getElementById('input-rec-date').value.trim();
    const note = document.getElementById('input-rec-note').value.trim();
    const ioType = getSelectedIo();

    if (!name) { showToast('请输入姓名'); return; }
    if (!amountStr) { showToast('请输入金额'); return; }

    let amount = parseFloat(amountStr);
    if (isNaN(amount)) { showToast('金额格式错误'); return; }
    if (ioType === '支出') amount = -Math.abs(amount);
    else amount = Math.abs(amount);

    const book = getCurrentBook();
    if (!book) return;

    if (AppState.editingRecIndex !== null && AppState.editingBookId) {
      // 编辑已有记录
      const editBook = AppState.books.find(b => b.id === AppState.editingBookId);
      if (editBook && editBook.records[AppState.editingRecIndex]) {
        const rec = editBook.records[AppState.editingRecIndex];
        rec.name = name;
        rec.amount = amount;
        rec.io_type = ioType;
        rec.date = date;
        rec.note = note;
      }
      AppState.editingRecIndex = null;
      AppState.editingBookId = null;
    } else {
      // 新记录
      const maxSeq = Math.max(0, ...(book.records || []).map(r => r.seq || 0));
      book.records = book.records || [];
      book.records.push(createRecord(name, amount, ioType, date, note, 0, maxSeq + 1));
    }

    await saveAndRefresh();
    closeModal('modal-record');
    renderBook();
    showToast('已保存');
  });

  // ---- 记录操作菜单 ----
  document.getElementById('menu-edit-record').addEventListener('click', () => {
    editCurrentRecord();
  });

  document.getElementById('menu-delete-record').addEventListener('click', () => {
    if (confirm('确定删除这条记录吗？')) {
      deleteCurrentRecord();
    }
  });

  // ---- 设置弹窗 ----
  document.getElementById('btn-settings-close').addEventListener('click', async () => {
    // 保存每页行数
    const rowsInput = document.getElementById('input-rows-per-page');
    const rows = parseInt(rowsInput.value);
    if (rows >= 4 && rows <= 20) {
      BookState.rowsPerPage = rows;
      await saveConfig('rows_per_page', rows);
    }
    closeModal('modal-settings');
  });

  document.getElementById('btn-export-data').addEventListener('click', exportData);

  document.getElementById('btn-import-data').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });

  document.getElementById('file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const ok = await importData(file);
      if (ok) {
        renderShelf();
        showPage('page-shelf');
      }
    }
    e.target.value = ''; // 重置文件选择
  });

  document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (confirm('确定清空所有数据吗？此操作不可恢复！')) {
      clearAllData();
      closeModal('modal-settings');
    }
  });

  // ---- 弹窗关闭按钮 ----
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.modal);
    });
  });

  // ---- 点击弹窗外部关闭 ----
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.style.display = 'none';
      }
    });
  });
}

/** 注册 Service Worker */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/** 应用启动 */
async function init() {
  // 加载配置
  BookState.rowsPerPage = await getConfig('rows_per_page', 12);
  document.getElementById('input-rows-per-page').value = BookState.rowsPerPage;

  // 加载数据
  AppState.books = await loadAllBooks();

  // 初始化
  initCoverPicker();
  initIoToggle();
  bindEvents();
  renderShelf();
  registerSW();
}

// 启动
document.addEventListener('DOMContentLoaded', init);
