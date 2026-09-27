/**
 * 翻书页 - 双页翻书模式
 */

// 当前翻书状态
const BookState = {
  bookId: null,
  currentPage: 0,    // 当前页组索引（每组2页）
  rowsPerPage: 12,
  flipFrom: 'shelf', // 来源：shelf=书架, person=搜索
};

/** 打开账本 */
function openBook(bookId, fromPage) {
  BookState.bookId = bookId;
  BookState.currentPage = 0;
  BookState.flipFrom = fromPage || 'shelf';
  showPage('page-book');
  renderBook();
}

/** 获取当前账本 */
function getCurrentBook() {
  return AppState.books.find(b => b.id === BookState.bookId);
}

/** 渲染翻书页 */
function renderBook() {
  const book = getCurrentBook();
  if (!book) { showPage('page-shelf'); return; }

  document.getElementById('book-title').textContent = book.title;
  document.getElementById('book-date').textContent = book.event_date || '';

  const records = book.records || [];
  const rowsPerPage = BookState.rowsPerPage;
  const totalPages = Math.max(1, Math.ceil(records.length / rowsPerPage));
  const currentPage = Math.min(BookState.currentPage, totalPages - 1);
  BookState.currentPage = currentPage;

  // 页码指示
  const indicator = totalPages > 0 ? `第 ${currentPage + 1} / ${totalPages} 页` : '暂无记录';
  document.getElementById('page-indicator').textContent = indicator;

  // 翻页按钮状态
  document.getElementById('btn-prev-page').disabled = currentPage <= 0;
  document.getElementById('btn-next-page').disabled = currentPage >= totalPages - 1;

  // 当前页的记录
  const start = currentPage * rowsPerPage;
  const pageRecords = records.slice(start, start + rowsPerPage);

  // 分割左右页
  const half = Math.ceil(rowsPerPage / 2);
  const leftRecords = pageRecords.slice(0, half);
  const rightRecords = pageRecords.slice(half);

  // 渲染左右页
  renderPage('page-left-content', 'page-left-footer', leftRecords, start, book);
  renderPage('page-right-content', 'page-right-footer', rightRecords, start + half, book);

  // 合计
  const sum = bookSumAmount(book);
  const count = bookRecordCount(book);
  const totalEl = document.getElementById('book-total');
  const dirText = sum < 0 ? '净支出' : '净收礼';
  totalEl.textContent = `共 ${count} 条 · ${dirText} ${formatAmount(Math.abs(sum))}`;

  // 绑定记录点击
  document.querySelectorAll('#page-left-content .record-row, #page-right-content .record-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.recIndex);
      const book = getCurrentBook();
      if (book && book.records[idx]) {
        openRecordMenu(book.id, idx);
      }
    });
  });
}

/** 渲染单页内容 */
function renderPage(contentId, footerId, records, startIdx, book) {
  const content = document.getElementById(contentId);
  const footer = document.getElementById(footerId);

  if (records.length === 0) {
    content.innerHTML = '<div class="page-blank" style="height:100%">空白页</div>';
    footer.textContent = '';
    return;
  }

  content.innerHTML = records.map((rec, i) => {
    const globalIdx = startIdx + i;
    const isExpense = rec.io_type === '支出';
    const amountCls = isExpense ? 'expense' : 'income';
    const markedCls = rec.marked ? ' marked' : '';
    const dateStr = rec.date || book.event_date || '';

    return `
      <div class="record-row${markedCls}" data-rec-index="${globalIdx}">
        <span class="rec-seq">${rec.seq || (globalIdx + 1)}</span>
        <span class="rec-name">${escapeHtml(rec.name)}</span>
        <span class="rec-amount ${amountCls}">${formatAmount(isExpense ? -Math.abs(rec.amount) : rec.amount)}</span>
      </div>
    `;
  }).join('');

  // 页脚显示日期范围
  const dates = records.map(r => r.date || book.event_date).filter(Boolean);
  footer.textContent = dates.length > 0 ? dates[0] : '';
}

/** 翻页 */
function flipPage(direction) {
  const book = getCurrentBook();
  if (!book) return;

  const records = book.records || [];
  const totalPages = Math.max(1, Math.ceil(records.length / BookState.rowsPerPage));
  const newPage = BookState.currentPage + direction;

  if (newPage < 0 || newPage >= totalPages) return;

  // 动画
  const container = document.getElementById('book-spread');
  const animCls = direction > 0 ? 'page-flip-in' : 'page-flip-in';
  container.classList.remove('page-flip-in', 'page-flip-out');
  void container.offsetWidth; // 触发重排
  container.classList.add(animCls);

  BookState.currentPage = newPage;
  renderBook();
}

/** 打开记录操作菜单 */
function openRecordMenu(bookId, recIndex) {
  AppState.editingBookId = bookId;
  AppState.editingRecIndex = recIndex;
  openModal('modal-record-menu');
}

/** 编辑记录 */
function editCurrentRecord() {
  const book = AppState.books.find(b => b.id === AppState.editingBookId);
  if (!book) return;
  const rec = book.records[AppState.editingRecIndex];
  if (!rec) return;

  closeModal('modal-record-menu');

  document.getElementById('modal-record-title').textContent = '编辑记录';
  document.getElementById('input-rec-name').value = rec.name || '';
  document.getElementById('input-rec-amount').value = Math.abs(rec.amount) || '';
  document.getElementById('input-rec-date').value = rec.date || '';
  document.getElementById('input-rec-note').value = rec.note || '';

  // 设置收支切换
  document.querySelectorAll('.io-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.io === (rec.io_type || '收入'));
  });

  openModal('modal-record');
}

/** 删除记录 */
async function deleteCurrentRecord() {
  const book = AppState.books.find(b => b.id === AppState.editingBookId);
  if (!book) return;
  book.records.splice(AppState.editingRecIndex, 1);
  closeModal('modal-record-menu');
  await saveAndRefresh();
  renderBook();
  showToast('已删除');
}
