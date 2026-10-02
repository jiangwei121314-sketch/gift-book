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

/* ========== 系统历史栈导航 ==========
 * 每次页面切换写入浏览器/手机历史：
 *  - 安卓：系统返回键 / 边缘内退 = 应用内返回
 *  - 苹果：配合自加左边缘手势
 * 状态：{p:'shelf'} / {p:'search', q:词} / {p:'book', b:账本, page, from}
 */

/** 跳搜索页（push 历史） */
function navSearch(keyword) {
  keyword = keyword || '';
  document.getElementById('search-input').value = keyword;
  document.getElementById('btn-search-clear').style.display =
    keyword ? 'flex' : 'none';
  performSearch(keyword);
  showPage('page-search');
  history.pushState({ p: 'search', q: keyword }, '');
}

/** 应用内返回：非主页状态走系统历史；否则执行 fallback */
function navBack(fallback) {
  var st = history.state;
  if (st && st.p && st.p !== 'shelf') {
    history.back();
  } else if (fallback) {
    fallback();
  }
}

/** 按历史状态恢复页面（popstate：系统返回/前进触发） */
function applyHistoryState(st) {
  if (!st || st.p === 'shelf') {
    renderShelf();
    showPage('page-shelf');
  } else if (st.p === 'search') {
    var q = st.q || '';
    document.getElementById('search-input').value = q;
    document.getElementById('btn-search-clear').style.display =
      q ? 'flex' : 'none';
    performSearch(q);
    showPage('page-search');
  } else if (st.p === 'book') {
    BookState.bookId = st.b;
    BookState.currentPage = st.page || 0;
    BookState.flipFrom = st.from || 'shelf';
    showPage('page-book');
    renderBook();
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

/** 切换书架排列：1=每排一个，2=每排两个（默认）。persist 为 true 时保存配置 */
function applyShelfCols(cols, persist) {
  var grid = document.getElementById('shelf-grid');
  grid.classList.toggle('cols-1', cols === 1);
  var b1 = document.getElementById('btn-cols-1');
  var b2 = document.getElementById('btn-cols-2');
  if (b1 && b2) {
    b1.classList.toggle('selected', cols === 1);
    b2.classList.toggle('selected', cols !== 1);
  }
  if (persist) saveConfig('shelf_cols', cols).catch(function() {});
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
    navSearch('');
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
    navBack(function() {
      renderShelf();
      showPage('page-shelf');
    });
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
        navSearch(val);
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
    navBack(function() {
      renderShelf();
      showPage('page-shelf');
    });
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

  // ---- 账本排列切换（每排一个/两个，即时生效并保存） ----
  bind('btn-cols-1', 'click', function() { applyShelfCols(1, true); });
  bind('btn-cols-2', 'click', function() { applyShelfCols(2, true); });

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
  // 文件选择为原生控件直点（独立模式可靠），无需 JS 触发

  // ---- 扫一扫导入 ----
  bind('btn-qr-scan', 'click', function() {
    closeModal('modal-settings');
    QrScan.open();
  });
  bind('btn-qr-close', 'click', function() { QrScan.close(); });
  bind('btn-qr-reset', 'click', function() { QrScan.reset(); });
  bind('qr-file', 'change', function(e) {
    QrScan.pickImages(e.target.files);
    e.target.value = '';
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
      if (e.target === overlay) {
        if (overlay.id === 'modal-qrscan') QrScan.close();
        else overlay.style.display = 'none';
      }
    });
  });
}

/** 左边缘内滑返回手势（手指从最左边缘向右拖） */
function initEdgeSwipe() {
  var EDGE_ZONE = 26;       // 触发起始区（距左屏边）
  var TRIGGER_DX = 72;      // 拖过此距离即返回
  var hint = null;
  var startX = 0, startY = 0, tracking = false, fired = false;

  function getHint() {
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'edge-back-hint';
      hint.innerHTML = '&#8249;';
      document.body.appendChild(hint);
    }
    return hint;
  }

  document.addEventListener('touchstart', function(e) {
    var t = e.touches[0];
    var tag = (e.target && e.target.tagName) ? e.target.tagName : '';
    if (t.clientX <= EDGE_ZONE && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      // 只在有上一页时启用
      var st = history.state;
      if (st && st.p && st.p !== 'shelf') {
        tracking = true;
        fired = false;
        startX = t.clientX;
        startY = t.clientY;
      }
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', function(e) {
    if (!tracking) return;
    var t = e.touches[0];
    var dx = t.clientX - startX;
    var dy = t.clientY - startY;
    if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
    // 以横向为主：拦截纵向页面滚动
    if (Math.abs(dx) > Math.abs(dy)) {
      if (!fired) e.preventDefault();
      var h = getHint();
      h.classList.add('active');
      h.classList.toggle('ready', dx >= TRIGGER_DX);
      h.textContent = dx >= TRIGGER_DX ? '\u2713 返回' : '\u2039';
    } else {
      tracking = false;
      getHint().classList.remove('active', 'ready');
    }
  }, { passive: false, capture: true });

  function endGesture() {
    if (!tracking) return;
    var h = getHint();
    var wasReady = h.classList.contains('ready');
    h.classList.remove('active', 'ready');
    tracking = false;
    if (wasReady && !fired) {
      fired = true;
      navBack(function() {
        renderShelf();
        showPage('page-shelf');
      });
    }
  }
  document.addEventListener('touchend', endGesture, { capture: true });
  document.addEventListener('touchcancel', endGesture, { capture: true });
}

/** 系统返回/前进（安卓返回键同样触发） */
function initHistory() {
  if (!history.state || history.state.p !== 'shelf') {
    history.replaceState({ p: 'shelf' }, '');
  }
  window.addEventListener('popstate', function(e) {
    applyHistoryState(e.state);
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
  // 历史栈 + 边缘手势（最先就绪）
  try { initHistory(); } catch (e) { console.error('历史栈初始化失败:', e); }

  // 先绑定事件 —— 即使数据加载失败按钮也能用
  try {
    initCoverPicker();
    initIoToggle();
    bindEvents();
    initEdgeSwipe();
    initToggleHandle();
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
    return getConfig('shelf_cols', 2).catch(function() { return 2; });
  }).then(function(cols) {
    applyShelfCols(cols === 1 ? 1 : 2, false);
  }).then(function() {
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
