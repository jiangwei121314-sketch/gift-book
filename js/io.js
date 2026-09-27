/**
 * 数据导入导出 - 与电脑版 MLT 数据格式完全兼容
 * 导出 data.json（不含照片路径中的绝对路径，手机端照片暂不处理）
 */

/**
 * 导出数据为 JSON 文件
 * 格式与电脑版 data.json 完全一致
 */
function exportData() {
  const data = {
    books: AppState.books.map(book => ({
      id: book.id,
      title: book.title,
      category: book.category,
      event_date: book.event_date,
      cover: book.cover,
      cover_image: book.cover_image,
      note: book.note,
      photos: book.photos || {},
      records: (book.records || []).map(r => ({
        name: r.name,
        amount: r.amount,
        event: r.event,
        date: r.date,
        io_type: r.io_type,
        note: r.note,
        page_no: r.page_no,
        seq: r.seq,
        marked: r.marked,
      })),
    }))
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const ts = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `人情簿数据备份_${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('数据已导出');
}

/**
 * 导入 JSON 数据
 * 兼容电脑版 MLT 导出的 data.json 格式
 */
async function importData(file) {
  if (!file) return;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const books = data.books || [];

        // 格式校验和清理
        const cleanedBooks = books.map(b => ({
          id: b.id || genId(),
          title: b.title || '',
          category: b.category || '',
          event_date: b.event_date || '',
          cover: b.cover || 'red',
          cover_image: b.cover_image || '',
          note: b.note || '',
          photos: b.photos || {},
          records: (b.records || []).map(r => ({
            name: r.name || '',
            amount: parseFloat(r.amount) || 0,
            event: r.event || '',
            date: r.date || '',
            io_type: (r.io_type === '支出' ? '支出' : '收入'),
            note: r.note || '',
            page_no: parseInt(r.page_no) || 0,
            seq: parseInt(r.seq) || 0,
            marked: !!r.marked,
          })),
        }));

        AppState.books = cleanedBooks;
        await saveAllBooks(cleanedBooks);
        await saveConfig('lastUpdated', Date.now());

        showToast(`成功导入 ${cleanedBooks.length} 本账本`);
        resolve(true);
      } catch (err) {
        showToast('文件格式错误：' + err.message);
        resolve(false);
      }
    };
    reader.onerror = () => {
      showToast('文件读取失败');
      resolve(false);
    };
    reader.readAsText(file);
  });
}

/** 清空所有数据 */
async function clearAllData() {
  AppState.books = [];
  await saveAllBooks([]);
  await saveConfig('lastUpdated', Date.now());
  renderShelf();
  showToast('已清空所有数据');
}
