/**
 * 主入口 - 应用状态管理 + 页面路由 + 事件绑定
 */

var AppState = {
  books: [],
  editingBookId: null,
  editingRecIndex: null,
  editingBookIdForModal: null,
};

/** 保存并刷新 */
async function saveAndRefresh() {
  await saveAllBooks(AppState.books);
  await saveConfig('lastUpdated', Date.now());
}

/** 切换页面 */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById(pageId).classList.add('active');
  // 翻书页返回按钮统一只显示 ‹（返回行为仍按来源区分）
  if (pageId === 'page-book') {
    document.getElementById('btn-book-back').innerHTML = '&#8249;';
  }
}

/** 打开/关闭弹窗 */
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

/** Toast */
function showToast(msg, duration) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, duration || 2000);
}

/** 初始化封面选择器 */
function initCoverPicker() {
  var picker = document.getElementById('cover-picker');
  picker.innerHTML = Object.entries(COVER_COLORS).map(function(entry) {
    var key = entry[0], color = entry[1];
    return '<div class="cover-option' + (key === 'red' ? ' selected' : '') +
      '" data-cover="' + key + '" style="background:' + color +
      '" title="' + COVER_NAMES[key] + '"></div>';
  }).join('');
  picker.querySelectorAll('.cover-option').forEach(function(opt) {
    opt.addEventListener('click', function() {
      picker.querySelectorAll('.cover-option').forEach(function(o) { o.classList.remove('selected'); });
      opt.classList.add('selected');
    });
  });
}

function getSelectedCover() {
  var sel = document.querySelector('.cover-option.selected');
  return sel ? sel.dataset.cover : 'red';
}

/** 初始化收支切换 */
function initIoToggle() {
  document.querySelectorAll('.io-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.io-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
}

function getSelectedIo() {
  var active = document.querySelector('.io-btn.active');
  return active ? active.dataset.io : '收入';
}

/** 安全绑定：元素不存在时只警告，不抛错中断后续绑定 */
function bind(id, eventName, fn) {
  var el = document.getElementById(id);
  if (!el) {
    console.warn('绑定失败，页面缺少 #' + id);
    return;
  }
  el.addEventListener(eventName, fn);
}

/** 绑定所有事件 */
function bindEvents() {
  // ---- 书架页 ----
  bind('btn-search', 'click', function() {
    _searchStack = []; // 从主页进入搜索，重置历史
    showPage('page-search');
    document.getElementById('search-input').focus();
  });

  bind('btn-add-book', 'click', function() {
    AppState.editingBookIdForModal = null;
    document.getElementById('modal-book-title').textContent = '添加账本';
    document.getElementById('input-book-title').value = '';
    document.getElementById('input-book-category').value = '';
    document.getElementById('input-book-date').value = '';
    document.getElementById('input-book-note').value = '';
    document.querySelectorAll('.cover-option').forEach(function(o) {
      o.classList.toggle('selected', o.dataset.cover === 'red');
    });
    openModal('modal-book');
  });

  bind('btn-settings', 'click', function() {
    openModal('modal-settings');
  });

  // 总表展开/收起
  bind('shelf-right-toggle', 'click', toggleShelfTable);
  bind('btn-collapse-table', 'click', toggleShelfTable);

  // ---- 翻书页 ----
  bind('btn-book-back', 'click', function() {
    if (BookState.flipFrom === 'person') {
      showPage('page-search');
    } else {
      renderShelf();
      showPage('page-shelf');
    }
  });

  bind('btn-prev-page', 'click', function() { flipPage(-1); });
  bind('btn-next-page', 'click', function() { flipPage(1); });

  var bookBody = document.getElementById('book-body');
  if (bookBody) {
    bindSwipe(bookBody,
      function() { flipPage(1); },
      function() { flipPage(-1); }
    );
  }

  // 翻书页搜索栏 - 输入后跳转到搜索页
  var _bookSearchTimer = null;
  bind('book-search-input', 'input', function(e) {
    var val = e.target.value.trim();
    document.getElementById('btn-book-search-clear').style.display = val ? 'flex' : 'none';
    clearTimeout(_bookSearchTimer);
    if (val) {
      _bookSearchTimer = setTimeout(function() {
        document.getElementById('search-input').value = val;
        showPage('page-search');
        performSearch(val, true);
        document.getElementById('search-input').focus();
      }, 500);
    }
  });

  bind('btn-book-search-clear', 'click', function() {
    document.getElementById('book-search-input').value = '';
    document.getElementById('btn-book-search-clear').style.display = 'none';
  });

  bind('btn-add-record', 'click', function() {
    AppState.editingRecIndex = null;
    document.getElementById('modal-record-title').textContent = '添加记录';
    document.getElementById('input-rec-name').value = '';
    document.getElementById('input-rec-amount').value = '';
    document.getElementById('input-rec-date').value = '';
    document.getElementById('input-rec-note').value = '';
    document.querySelectorAll('.io-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.io === '收入');
    });
    openModal('modal-record');
  });

  // ---- 搜索页 ----
  bind('btn-search-back', 'click', function() {
    // 有上一次搜索 → 回到上一次搜索结果；没有 → 回主页
    _searchStack.pop();
    var prev = _searchStack[_searchStack.length - 1];
    if (prev) {
      var inp = document.getElementById('search-input');
      inp.value = prev;
      document.getElementById('btn-search-clear').style.display = 'flex';
      performSearch(prev, false);
    } else {
      renderShelf();
      showPage('page-shelf');
    }
  });

  bind('search-input', 'input', function(e) {
    performSearch(e.target.value);
  });

  bind('btn-search-clear', 'click', function() {
    document.getElementById('search-input').value = '';
    performSearch('');
    document.getElementById('search-input').focus();
  });

  // ---- 账本弹窗 ----
  bind('btn-book-cancel', 'click', function() {
    closeModal('modal-book');
  });

  bind('btn-book-save', 'click', function() {
    var title = document.getElementById('input-book-title').value.trim();
    if (!title) { showToast('请输入账本名称'); return; }
    var category = document.getElementById('input-book-category').value.trim();
    var date = document.getElementById('input-book-date').value.trim();
    var note = document.getElementById('input-book-note').value.trim();
    var cover = getSelectedCover();

    if (AppState.editingBookIdForModal) {
      var book = AppState.books.find(function(b) { return b.id === AppState.editingBookIdForModal; });
      if (book) {
        book.title = title; book.category = category;
        book.event_date = date; book.note = note; book.cover = cover;
      }
    } else {
      AppState.books.push(createBook(title, category, date, cover, note));
    }
    saveAndRefresh().then(function() {
      closeModal('modal-book');
      renderShelf();
      showToast(AppState.editingBookIdForModal ? '已更新' : '已创建');
    });
  });

  // ---- 记录弹窗 ----
  bind('btn-rec-cancel', 'click', function() {
    closeModal('modal-record');
  });

  bind('btn-rec-save', 'click', function() {
    var name = document.getElementById('input-rec-name').value.trim();
    var amountStr = document.getElementById('input-rec-amount').value.trim();
    var date = document.getElementById('input-rec-date').value.trim();
    var note = document.getElementById('input-rec-note').value.trim();
    var ioType = getSelectedIo();

    if (!name) { showToast('请输入姓名'); return; }
    if (!amountStr) { showToast('请输入金额'); return; }
    var amount = parseFloat(amountStr);
    if (isNaN(amount)) { showToast('金额格式错误'); return; }
    if (ioType === '支出') amount = -Math.abs(amount);
    else amount = Math.abs(amount);

    var book = getCurrentBook();
    if (!book) return;

    if (AppState.editingRecIndex !== null && AppState.editingBookId) {
      var editBook = AppState.books.find(function(b) { return b.id === AppState.editingBookId; });
      if (editBook && editBook.records[AppState.editingRecIndex]) {
        var rec = editBook.records[AppState.editingRecIndex];
        rec.name = name; rec.amount = amount; rec.io_type = ioType;
        rec.date = date; rec.note = note;
      }
      AppState.editingRecIndex = null;
      AppState.editingBookId = null;
    } else {
      var maxSeq = Math.max.apply(null, [0].concat((book.records || []).map(function(r) { return r.seq || 0; })));
      book.records = book.records || [];
      book.records.push(createRecord(name, amount, ioType, date, note, 0, maxSeq + 1));
    }

    saveAndRefresh().then(function() {
      closeModal('modal-record');
      renderBook();
      showToast('已保存');
    });
  });

  // ---- 记录操作菜单 ----
  bind('menu-edit-record', 'click', editCurrentRecord);
  bind('menu-delete-record', 'click', function() {
    if (confirm('确定删除这条记录吗？')) deleteCurrentRecord();
  });

  // ---- 设置弹窗：关闭 ----
  bind('btn-settings-close', 'click', function() {
    var rowsInput = document.getElementById('input-rows-per-page');
    var rows = parseInt(rowsInput.value);
    if (rows >= 4 && rows <= 20) {
      BookState.rowsPerPage = rows;
      saveConfig('rows_per_page', rows).then(function() {
        closeModal('modal-settings');
      }).catch(function() {
        closeModal('modal-settings');
      });
    } else {
      closeModal('modal-settings');
    }
  });

  // 导出/导入/清空
  bind('btn-export-data', 'click', function() {
    try { exportData(); } catch (err) { console.error(err); showToast('导出失败'); }
  });
  bind('btn-import-data', 'click', function() {
    var fileInput = document.getElementById('file-import');
    if (fileInput) fileInput.click();
  });
  bind('file-import', 'change', function(e) {
    var file = e.target.files[0];
    if (file) {
      importData(file).then(function(ok) {
        if (ok) {
          renderShelf();
          showPage('page-shelf');
        }
      }).catch(function(err) {
        console.error(err);
        showToast('导入失败');
      });
    }
    e.target.value = '';
  });
  bind('btn-clear-all', 'click', function() {
    if (confirm('确定清空所有数据吗？此操作不可恢复！')) {
      clearAllData();
      closeModal('modal-settings');
    }
  });

  // ---- 弹窗关闭 ----
  document.querySelectorAll('.modal-close').forEach(function(btn) {
    btn.addEventListener('click', function() {
      closeModal(btn.dataset.modal);
    });
  });
  // 点击遮罩层关闭弹窗（点击弹窗内容不关闭）
  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.style.display = 'none';
    });
  });
}

/** 注册 Service Worker */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function() {});
  }
}

/** 应用启动（每一步都容错，保证事件绑定一定执行） */
function init() {
  // 先绑定事件 —— 即使数据加载失败按钮也能用
  try {
    initCoverPicker();
    initIoToggle();
    bindEvents();
  } catch (e) {
    console.error('事件绑定失败:', e);
  }

  // 再加载数据
  getConfig('rows_per_page', 12).then(function(rows) {
    if (rows >= 4 && rows <= 20) {
      BookState.rowsPerPage = rows;
      document.getElementById('input-rows-per-page').value = rows;
    }
  }).catch(function() {}).then(function() {
    return loadAllBooks();
  }).then(function(books) {
    AppState.books = books || [];
  }).catch(function(err) {
    console.error('加载数据失败:', err);
    AppState.books = [];
  }).then(function() {
    return restoreTableState().catch(function() {});
  }).then(function() {
    renderShelf();
  }).catch(function(err) {
    console.error('渲染失败:', err);
  });

  registerSW();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
