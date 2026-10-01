/**
 * 书架页 - 左侧卡片 + 右侧可折叠总表（对齐桌面版）
 */

var _tableExpanded = false;

/** 解析账本事项日期为可比较整数 YYYYMM；无法解析 → Infinity（排最后） */
function bookEventTime(book) {
  var s = book.event_date || '';
  var m = s.match(/(\d{4,5})\s*年\s*(\d{1,2})?/) ||
          s.match(/^(\d{4})[-/.](\d{1,2})/);
  if (!m) return Infinity;
  var y = m[1];
  if (y.length === 5) y = y.slice(0, 4); // 兼容误录 20226 → 2022
  var mo = m[2] ? parseInt(m[2], 10) : 6;
  return parseInt(y, 10) * 100 + mo;
}

/** 是否为支出账本（固定放最后） */
function isExpenseLedger(book) {
  var t = (book.title || '') + (book.category || '');
  return t.indexOf('支出') >= 0;
}

/** 书架展示顺序：时间升序，支出账本永远最后 */
function sortedShelfBooks() {
  return AppState.books.slice().sort(function(a, b) {
    var ea = isExpenseLedger(a), eb = isExpenseLedger(b);
    if (ea !== eb) return ea ? 1 : -1;
    var ta = bookEventTime(a), tb = bookEventTime(b);
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0);
  });
}

/** 渲染书架 */
function renderShelf() {
  var grid = document.getElementById('shelf-grid');
  var empty = document.getElementById('shelf-empty');
  var summary = document.getElementById('shelf-summary');
  var books = AppState.books;

  if (!books || books.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'flex';
    summary.textContent = '';
    renderShelfTable();
    return;
  }
  empty.style.display = 'none';

  // 统计
  var totalIncome = 0, totalExpense = 0, totalRecords = 0;
  books.forEach(function(b) {
    (b.records || []).forEach(function(r) {
      totalRecords++;
      if (r.io_type === '支出') totalExpense += Math.abs(r.amount);
      else totalIncome += Math.abs(r.amount);
    });
  });
  summary.textContent =
    '共 ' + books.length + ' 本账本 · ' + totalRecords + ' 条记录 · 收 ¥' +
    totalIncome.toLocaleString() + ' · 支 ¥' + totalExpense.toLocaleString();

  // 渲染卡片（按时间排序，支出账本最后）
  var cardsHtml = '';
  sortedShelfBooks().forEach(function(book) {
    var count = bookRecordCount(book);
    var sum = bookSumAmount(book);
    var color = COVER_COLORS[book.cover] || COVER_COLORS.red;
    var dirText = sum < 0 ? '净支出' : '净收礼';

    cardsHtml +=
      '<div class="book-card" data-book-id="' + book.id + '" style="background:' + color + '">' +
        '<div class="book-card-body">' +
          '<span class="book-card-badge">' + escapeHtml(book.category || '') + '</span>' +
          '<div class="book-card-title">' + escapeHtml(book.title) + '</div>' +
          '<div class="book-card-info">' + escapeHtml(book.event_date || '') + ' · ' + count + ' 条记录</div>' +
          '<div class="book-card-lunar">' + escapeHtml(lunarLabel(book.event_date)) + '</div>' +
          '<div class="book-card-amount-row">' +
            '<span class="book-card-amount">' + formatAmount(sum) + '</span>' +
            '<span class="book-card-direction">' + dirText + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
  });

  cardsHtml +=
    '<div class="new-book-card" id="card-new-book">' +
      '<span class="new-book-plus">+</span>' +
      '<span class="new-book-text">新建一本账本</span>' +
    '</div>';

  grid.innerHTML = cardsHtml;

  grid.querySelectorAll('.book-card').forEach(function(card) {
    card.addEventListener('click', function() {
      openBook(card.dataset.bookId);
    });
  });

  var newCard = document.getElementById('card-new-book');
  if (newCard) {
    newCard.addEventListener('click', function() {
      document.getElementById('btn-add-book').click();
    });
  }

  renderShelfTable();
}

/** 渲染右侧总表 */
function renderShelfTable() {
  var tbody = document.getElementById('shelf-tbody');
  var books = AppState.books;

  var allRecords = [];
  books.forEach(function(book) {
    (book.records || []).forEach(function(rec, idx) {
      allRecords.push({ book: book, record: rec, index: idx });
    });
  });

  // 按日期+序号排序
  allRecords.sort(function(a, b) {
    var da = a.record.date || a.book.event_date || '';
    var db = b.record.date || b.book.event_date || '';
    if (da !== db) return da < db ? -1 : 1;
    return (a.record.seq || a.index + 1) - (b.record.seq || b.index + 1);
  });

  var html = '';
  allRecords.forEach(function(item, i) {
    var r = item.record;
    var book = item.book;
    var isExpense = r.io_type === '支出';
    var amountCls = isExpense ? 'expense' : 'income';
    var markedCls = r.marked ? ' class="marked"' : '';
    var amount = formatAmount(isExpense ? -Math.abs(r.amount) : r.amount);

    html +=
      '<tr' + markedCls + ' data-book-id="' + book.id + '" data-rec-index="' + item.index + '">' +
        '<td>' + (r.seq || (i + 1)) + '</td>' +
        '<td>' + escapeHtml(r.name) + '</td>' +
        '<td class="amount ' + amountCls + '">' + amount + '</td>' +
        '<td>' + escapeHtml(r.event || book.category || '') + '</td>' +
        '<td>' + (r.page_no || '') + '</td>' +
        '<td>' + escapeHtml(r.date || book.event_date || '') + '</td>' +
        '<td>' + escapeHtml(r.io_type || '收入') + '</td>' +
        '<td>' + escapeHtml(r.note || '') + '</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;

  tbody.querySelectorAll('tr').forEach(function(row) {
    row.addEventListener('click', function() {
      var bookId = row.dataset.bookId;
      if (bookId) openBook(bookId);
    });
  });
}

/** 切换总表展开/收起 */
function toggleShelfTable() {
  _tableExpanded = !_tableExpanded;
  var panel = document.getElementById('shelf-right-panel');
  var toggle = document.getElementById('shelf-right-toggle');
  var btn = document.getElementById('btn-collapse-table');
  panel.classList.toggle('expanded', _tableExpanded);
  // 未展开时竖条显示 «，展开后右上角按钮显示 »
  toggle.textContent = '«';
  btn.textContent = '»';
  saveConfig('table_collapsed', _tableExpanded);
}

/** 恢复总表状态 */
async function restoreTableState() {
  _tableExpanded = await getConfig('table_collapsed', false);
  var panel = document.getElementById('shelf-right-panel');
  var toggle = document.getElementById('shelf-right-toggle');
  var btn = document.getElementById('btn-collapse-table');
  panel.classList.toggle('expanded', _tableExpanded);
  toggle.textContent = '«';
  btn.textContent = '»';
}

/* ========== 竖条位置：长按后上下拖动 ==========
 * 位置比例存配置 toggle_pos（0..1，相对书架内容高度），换屏幕自动适配。
 */
var _tg = {
  el: null, body: null, timer: null,
  armed: false, dragging: false, suppress: false,
  startY: 0, startCenter: 0, center: 0, pos: 0.5,
};

/** 按比例把竖条放到对应位置 */
function applyTogglePosition() {
  if (!_tg.el) return;
  var bodyH = _tg.body.clientHeight;
  var h = _tg.el.offsetHeight || 72;
  var minC = h / 2, maxC = bodyH - h / 2;
  if (maxC <= minC) maxC = minC;
  var center = minC + (maxC - minC) * _tg.pos;
  _tg.center = center;
  _tg.el.style.transform = 'none';
  _tg.el.style.top = (center - h / 2) + 'px';
}

/** 长按计时结束 → 进入拖动模式 */
function _enterDrag() {
  _tg.dragging = true;
  _tg.el.classList.add('dragging');
  if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
}

function _cancelTimer() {
  if (_tg.timer) { clearTimeout(_tg.timer); _tg.timer = null; }
}

/** 拖动过程：把指针 Y 映射为受限中心位置 */
function _moveTo(clientY) {
  var bodyH = _tg.body.clientHeight;
  var h = _tg.el.offsetHeight || 72;
  var minC = h / 2, maxC = bodyH - h / 2;
  if (maxC <= minC) maxC = minC;
  var center = _tg.startCenter + (clientY - _tg.startY);
  if (center < minC) center = minC;
  if (center > maxC) center = maxC;
  _tg.center = center;
  _tg.el.style.transform = 'none';
  _tg.el.style.top = (center - h / 2) + 'px';
}

/** 松手：保存比例；拖动过则吃掉随后的 click（不触发展开/收起） */
function _endDrag() {
  if (!_tg.dragging) { _cancelTimer(); return; }
  _tg.dragging = false;
  _tg.el.classList.remove('dragging');
  var bodyH = _tg.body.clientHeight;
  var h = _tg.el.offsetHeight || 72;
  var span = bodyH - h;
  _tg.pos = span > 0 ? (_tg.center - h / 2) / span : 0.5;
  if (_tg.pos < 0) _tg.pos = 0;
  if (_tg.pos > 1) _tg.pos = 1;
  saveConfig('toggle_pos', _tg.pos);
  _tg.suppress = true; // 拖动后不触发点击切换
}

/** 初始化竖条拖动（只绑一次） */
function initToggleHandle() {
  _tg.el = document.getElementById('shelf-right-toggle');
  _tg.body = document.getElementById('shelf-body');
  if (!_tg.el || !_tg.body) return;

  // ---- 触摸 ----
  _tg.el.addEventListener('touchstart', function(e) {
    var t = e.touches[0];
    _tg.startY = t.clientY;
    _tg.startCenter = _tg.center || (_tg.el.offsetHeight || 72) / 2;
    _cancelTimer();
    _tg.timer = setTimeout(_enterDrag, 450);
  }, { passive: true });

  _tg.el.addEventListener('touchmove', function(e) {
    if (_tg.dragging) {
      e.preventDefault();
      _moveTo(e.touches[0].clientY);
    } else {
      // 未到长按就移动 → 放弃长按
      if (Math.abs(e.touches[0].clientY - _tg.startY) > 10) _cancelTimer();
    }
  }, { passive: false });

  _tg.el.addEventListener('touchend', function() {
    var wasDragging = _tg.dragging;
    _endDrag();
    if (!wasDragging) _cancelTimer();
  });
  _tg.el.addEventListener('touchcancel', function() {
    _cancelTimer();
    _tg.dragging = false;
    _tg.el.classList.remove('dragging');
  });

  // ---- 鼠标 ----
  _tg.el.addEventListener('mousedown', function(e) {
    e.preventDefault();
    _tg.startY = e.clientY;
    _tg.startCenter = _tg.center || _tg.el.offsetHeight / 2;
    _cancelTimer();
    _tg.timer = setTimeout(_enterDrag, 450);

    function onMove(ev) {
      if (_tg.dragging) _moveTo(ev.clientY);
      else if (Math.abs(ev.clientY - _tg.startY) > 8) _cancelTimer();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      _endDrag();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // 拖动松手后的 click 拦截（捕获阶段，先于 toggleShelfTable）
  _tg.el.addEventListener('click', function(e) {
    if (_tg.suppress) {
      _tg.suppress = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  window.addEventListener('resize', applyTogglePosition);

  // 恢复保存的位置
  getConfig('toggle_pos', 0.5).then(function(v) {
    if (typeof v === 'number' && v >= 0 && v <= 1) _tg.pos = v;
    applyTogglePosition();
  }).catch(function() { applyTogglePosition(); });
}

/** HTML 转义 */
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
