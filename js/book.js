/**
 * 翻书页 - 单页模式（照片 + 表格 + 滑动翻页）
 */

var BookState = {
  bookId: null,
  currentPage: 0,
  rowsPerPage: 12,
  flipFrom: 'shelf',
  _touchStartX: 0,
  _touchStartY: 0,
};

/** 打开账本（startPage=起始页，用于时间线跳转到对应页） */
function openBook(bookId, fromPage, startPage) {
  BookState.bookId = bookId;
  BookState.currentPage = startPage || 0;
  BookState.flipFrom = fromPage || 'shelf';
  history.pushState({
    p: 'book', b: bookId,
    page: BookState.currentPage,
    from: BookState.flipFrom,
  }, '');
  showPage('page-book');
  renderBook();
}

/** 获取当前账本 */
function getCurrentBook() {
  return AppState.books.find(function(b) { return b.id === BookState.bookId; });
}

/** 渲染翻书页 */
function renderBook() {
  var book = getCurrentBook();
  if (!book) { showPage('page-shelf'); return; }

  document.getElementById('book-title').textContent = book.title;
  document.getElementById('book-date').textContent = book.event_date || '';

  var records = book.records || [];
  var rowsPerPage = BookState.rowsPerPage;
  var totalPages = Math.max(1, Math.ceil(records.length / rowsPerPage));
  var currentPage = Math.min(BookState.currentPage, totalPages - 1);
  BookState.currentPage = currentPage;

  // 页码
  document.getElementById('page-indicator').textContent =
    totalPages > 0 ? '第 ' + (currentPage + 1) + ' / ' + totalPages + ' 页' : '暂无记录';
  document.getElementById('btn-prev-page').disabled = currentPage <= 0;
  document.getElementById('btn-next-page').disabled = currentPage >= totalPages - 1;

  // 当前页记录
  var start = currentPage * rowsPerPage;
  var pageRecords = records.slice(start, start + rowsPerPage);

  // 渲染照片（单页，页码 = currentPage + 1）
  renderSinglePhoto(currentPage + 1, book);

  // 渲染表格
  renderFlipTable(pageRecords, start, book);

  // 页合计
  var income = 0, expense = 0;
  pageRecords.forEach(function(r) {
    if (r.io_type === '支出') expense += Math.abs(r.amount);
    else income += Math.abs(r.amount);
  });
  document.getElementById('page-total').textContent =
    '本页 收入 ¥' + formatNumber(income) +
    '  支出 ¥' + formatNumber(expense) +
    '  结余 ¥' + formatNumber(income - expense);

  // 账本总计
  var sum = bookSumAmount(book);
  var count = bookRecordCount(book);
  var dirText = sum < 0 ? '净支出' : '净收礼';
  document.getElementById('book-total').textContent =
    '共 ' + count + ' 条 · ' + dirText + ' ' + formatAmount(Math.abs(sum));

  // 动画
  var body = document.getElementById('book-body');
  body.classList.remove('flip-anim');
  void body.offsetWidth;
  body.classList.add('flip-anim');
}

/** 渲染单页照片 */
function renderSinglePhoto(pageNo, book) {
  var label = document.getElementById('photo-label');
  var content = document.getElementById('photo-content');
  var photos = book.photos || {};

  label.textContent = '页码' + pageNo;

  if (photos[pageNo]) {
    var src = photos[pageNo];
    // 如果是 base64 直接用，否则尝试作为路径
    if (src.startsWith('data:')) {
      content.innerHTML = '<img src="' + src + '" alt="">';
    } else {
      content.innerHTML = '<img src="' + src + '" alt="" onerror="this.parentElement.textContent=\'照片加载失败\'">';
    }
  } else {
    content.textContent = '暂无照片';
  }
}

/** 渲染翻书表格 */
function renderFlipTable(records, startIdx, book) {
  var tbody = document.getElementById('flip-tbody');

  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#8a7760;padding:20px">暂无记录</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(function(rec, i) {
    var globalIdx = startIdx + i;
    var isExpense = rec.io_type === '支出';
    var amountCls = isExpense ? 'expense' : 'income';
    var markedCls = rec.marked ? ' class="marked"' : '';
    var amount = formatAmount(isExpense ? -Math.abs(rec.amount) : rec.amount);
    var dateStr = rec.date || book.event_date || '';

    return '<tr' + markedCls + ' data-rec-index="' + globalIdx + '">' +
      '<td>' + (rec.seq || (globalIdx + 1)) + '</td>' +
      '<td>' + escapeHtml(rec.name) + '</td>' +
      '<td class="amount ' + amountCls + '">' + amount + '</td>' +
      '<td>' + escapeHtml(rec.event || book.category || '') + '</td>' +
      '<td>' + (rec.page_no || '') + '</td>' +
      '<td>' + escapeHtml(dateStr) + '</td>' +
      '<td>' + escapeHtml(rec.io_type || '收入') + '</td>' +
      '<td>' + escapeHtml(rec.note || '') + '</td>' +
    '</tr>';
  }).join('');

  tbody.querySelectorAll('tr[data-rec-index]').forEach(function(row) {
    row.addEventListener('click', function() {
      var idx = parseInt(row.dataset.recIndex);
      var book = getCurrentBook();
      if (book && book.records[idx]) {
        openRecordMenu(book.id, idx);
      }
    });
  });
}

/** 格式化数字 */
function formatNumber(num) {
  if (!num && num !== 0) return '0';
  var abs = Math.abs(num);
  return abs % 1 === 0 ? abs.toLocaleString() : abs.toFixed(2);
}

/** 翻页 */
function flipPage(direction) {
  var book = getCurrentBook();
  if (!book) return;
  var records = book.records || [];
  var totalPages = Math.max(1, Math.ceil(records.length / BookState.rowsPerPage));
  var newPage = BookState.currentPage + direction;
  if (newPage < 0 || newPage >= totalPages) return;
  BookState.currentPage = newPage;
  // 更新当前历史的页码（返回再进入时停在当前页）
  if (history.state && history.state.p === 'book') {
    history.replaceState({
      p: 'book', b: BookState.bookId,
      page: newPage, from: BookState.flipFrom,
    }, '');
  }
  renderBook();
}

/** 绑定滑动手势（左边缘 28px 内起手让位给「边缘返回」） */
function bindSwipe(el, onSwipeLeft, onSwipeRight) {
  el.addEventListener('touchstart', function(e) {
    var x = e.touches[0].clientX;
    BookState._touchEdge = (x <= 28);
    BookState._touchStartX = x;
    BookState._touchStartY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchend', function(e) {
    if (BookState._touchEdge) return;  // 边缘起手由返回手势处理
    var dx = e.changedTouches[0].clientX - BookState._touchStartX;
    var dy = e.changedTouches[0].clientY - BookState._touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
  }, { passive: true });
}

/** 打开记录操作菜单 */
function openRecordMenu(bookId, recIndex) {
  AppState.editingBookId = bookId;
  AppState.editingRecIndex = recIndex;
  openModal('modal-record-menu');
}

/** 编辑当前记录 */
function editCurrentRecord() {
  var book = AppState.books.find(function(b) { return b.id === AppState.editingBookId; });
  if (!book) return;
  var rec = book.records[AppState.editingRecIndex];
  if (!rec) return;

  closeModal('modal-record-menu');
  document.getElementById('modal-record-title').textContent = '编辑记录';
  document.getElementById('input-rec-name').value = rec.name || '';
  document.getElementById('input-rec-amount').value = Math.abs(rec.amount) || '';
  document.getElementById('input-rec-date').value = rec.date || '';
  document.getElementById('input-rec-note').value = rec.note || '';
  document.querySelectorAll('.io-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.io === (rec.io_type || '收入'));
  });
  openModal('modal-record');
}

/** 删除当前记录 */
async function deleteCurrentRecord() {
  var book = AppState.books.find(function(b) { return b.id === AppState.editingBookId; });
  if (!book) return;
  book.records.splice(AppState.editingRecIndex, 1);
  closeModal('modal-record-menu');
  await saveAndRefresh();
  renderBook();
  showToast('已删除');
}
