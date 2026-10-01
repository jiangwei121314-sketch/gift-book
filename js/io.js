/**
 * 数据导入导出 - 与电脑版 MLT 数据格式完全兼容
 * 支持 base64 照片嵌入
 */

/**
 * 导出数据为 JSON 文件
 * 格式与电脑版 data.json 完全一致（含 base64 照片）
 */
function exportData() {
  var data = {
    books: AppState.books.map(function(book) {
      return {
        id: book.id,
        title: book.title,
        category: book.category,
        event_date: book.event_date,
        cover: book.cover,
        cover_image: book.cover_image,
        note: book.note,
        photos: book.photos || {},
        records: (book.records || []).map(function(r) {
          return {
            name: r.name,
            amount: r.amount,
            event: r.event,
            date: r.date,
            io_type: r.io_type,
            note: r.note,
            page_no: r.page_no,
            seq: r.seq,
            marked: r.marked,
          };
        }),
      };
    })
  };

  var blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json' }
  );
  var url = URL.createObjectURL(blob);

  var now = new Date();
  var ts = now.getFullYear() +
    (now.getMonth() + 1 < 10 ? '0' : '') + (now.getMonth() + 1) +
    (now.getDate() < 10 ? '0' : '') + now.getDate();
  var a = document.createElement('a');
  a.href = url;
  a.download = '人情簿数据备份_' + ts + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('数据已导出');
}

/**
 * 导入数据对象（文件导入 / 二维码扫码导入共用核心）
 * data: 已解析的 { books: [...] }
 */
async function importDataObject(data) {
  var books = data.books || [];

  var cleanedBooks = books.map(function(b) {
    return {
      id: b.id || genId(),
      title: b.title || '',
      category: b.category || '',
      event_date: b.event_date || '',
      cover: b.cover || 'red',
      cover_image: b.cover_image || '',
      note: b.note || '',
      photos: b.photos || {},
      records: (b.records || []).map(function(r) {
        return {
          name: r.name || '',
          amount: parseFloat(r.amount) || 0,
          event: r.event || '',
          date: r.date || '',
          io_type: (r.io_type === '支出' ? '支出' : '收入'),
          note: r.note || '',
          page_no: parseInt(r.page_no) || 0,
          seq: parseInt(r.seq) || 0,
          marked: !!r.marked,
        };
      }),
    };
  });

  AppState.books = cleanedBooks;
  await saveAllBooks(cleanedBooks);
  await saveConfig('lastUpdated', Date.now());
  return cleanedBooks.length;
}

/**
 * 导入 JSON 文件
 * 兼容电脑版 MLT 导出的 data.json 格式（含 base64 照片）
 */
async function importData(file) {
  if (!file) return false;

  return new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onload = async function(e) {
      try {
        var data = JSON.parse(e.target.result);
        var n = await importDataObject(data);
        showToast('成功导入 ' + n + ' 本账本');
        resolve(true);
      } catch (err) {
        showToast('文件格式错误：' + err.message);
        resolve(false);
      }
    };
    reader.onerror = function() {
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
