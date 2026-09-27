/**
 * 人物搜索页 - 精确匹配 + 同音/音近疑似
 */

/** 执行搜索 */
function performSearch(keyword) {
  const container = document.getElementById('search-results');
  const clearBtn = document.getElementById('btn-search-clear');

  clearBtn.style.display = keyword ? 'flex' : 'none';

  if (!keyword || !keyword.trim()) {
    container.innerHTML = '<div class="search-empty">输入姓名开始搜索</div>';
    return;
  }

  keyword = keyword.trim();
  const allNames = collectAllNames(AppState.books);

  // 精确匹配
  const exactMatches = allNames.filter(n => n === keyword);

  // 同音/音近匹配
  const suggestions = suggestGroup(keyword, allNames);

  // 构建结果列表
  let html = '';

  // 精确匹配
  for (const name of exactMatches) {
    const records = findRecordsByName(AppState.books, name);
    const books = [...new Set(records.map(r => r.book.title))];
    html += buildResultCard(name, 'exact', '精确', records, books);
  }

  // 同音/音近
  for (const sug of suggestions) {
    const records = findRecordsByName(AppState.books, sug.name);
    const books = [...new Set(records.map(r => r.book.title))];
    html += buildResultCard(sug.name, 'similar', sug.type, records, books);
  }

  if (!html) {
    html = '<div class="search-empty">未找到相关记录</div>';
  }

  container.innerHTML = html;

  // 绑定展开/收起
  container.querySelectorAll('.result-card-header').forEach(header => {
    header.addEventListener('click', () => {
      const detail = header.nextElementSibling;
      detail.classList.toggle('open');
      header.querySelector('.result-arrow').textContent =
        detail.classList.contains('open') ? '⌃' : '⌄';
    });
  });

  // 绑定时间线跳转
  container.querySelectorAll('.timeline-row').forEach(row => {
    row.addEventListener('click', () => {
      const bookId = row.dataset.bookId;
      if (bookId) {
        openBook(bookId, 'person');
      }
    });
  });
}

/** 构建搜索结果卡片 */
function buildResultCard(name, badgeType, badgeText, records, bookTitles) {
  const badgeCls = badgeType === 'exact' ? 'exact' : 'similar';
  const bookStr = bookTitles.join('、');

  let detailHtml = records.map(r => {
    const isExpense = r.record.io_type === '支出';
    const amountCls = isExpense ? 'expense' : 'income';
    const amount = formatAmount(isExpense ? -Math.abs(r.record.amount) : r.record.amount);
    const date = r.record.date || r.book.event_date || '';
    return `
      <div class="timeline-row" data-book-id="${r.book.id}">
        <span class="timeline-book">${escapeHtml(r.book.title)}</span>
        <span class="timeline-date">${escapeHtml(date)}</span>
        <span class="timeline-amount ${amountCls}">${amount}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="result-card">
      <div class="result-card-header">
        <div>
          <span class="result-name">${escapeHtml(name)}</span>
          <span class="result-badge ${badgeCls}">${badgeText}</span>
          <div class="result-books">${escapeHtml(bookStr)}</div>
        </div>
        <span class="result-arrow">⌄</span>
      </div>
      <div class="result-detail">${detailHtml}</div>
    </div>
  `;
}
