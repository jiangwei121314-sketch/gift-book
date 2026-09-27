/**
 * 书架页 - 封面卡片网格
 */

/** 渲染书架 */
function renderShelf() {
  const grid = document.getElementById('shelf-grid');
  const empty = document.getElementById('shelf-empty');
  const summary = document.getElementById('shelf-summary');

  const books = AppState.books;

  if (!books || books.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'flex';
    summary.textContent = '';
    return;
  }

  empty.style.display = 'none';

  // 统计
  let totalIncome = 0, totalExpense = 0, totalRecords = 0;
  books.forEach(b => {
    (b.records || []).forEach(r => {
      totalRecords++;
      if (r.io_type === '支出') totalExpense += Math.abs(r.amount);
      else totalIncome += Math.abs(r.amount);
    });
  });
  summary.textContent = `共 ${books.length} 本账本 · ${totalRecords} 条记录 · 收 ¥${totalIncome.toLocaleString()} · 支 ¥${totalExpense.toLocaleString()}`;

  // 渲染卡片
  grid.innerHTML = books.map(book => {
    const count = bookRecordCount(book);
    const sum = bookSumAmount(book);
    const color = COVER_COLORS[book.cover] || COVER_COLORS.red;
    const amountCls = sum < 0 ? 'negative' : 'positive';
    const coverContent = book.cover_image
      ? `<img src="${book.cover_image}" alt="">`
      : `<span class="cover-text">${escapeHtml(book.title || '?')}</span>`;

    return `
      <div class="book-card" data-book-id="${book.id}">
        <div class="book-card-cover" style="background:${color}">
          ${coverContent}
        </div>
        <div class="book-card-info">
          <div class="book-card-title">${escapeHtml(book.title)}</div>
          <div class="book-card-meta">
            <span>${count} 条</span>
            <span class="book-card-amount ${amountCls}">${formatAmount(sum)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 绑定点击
  grid.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', () => {
      const bookId = card.dataset.bookId;
      openBook(bookId);
    });
  });
}

/** HTML 转义 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
