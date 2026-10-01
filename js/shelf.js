/**
 * 书架页 - 左侧卡片 + 右侧可折叠总表（对齐桌面版）
 */

var _tableExpanded = false;

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

  // 渲染卡片
  var cardsHtml = '';
  books.forEach(function(book) {
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

/** HTML 转义 */
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
