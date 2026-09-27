/**
 * 数据模型 - 与电脑版 MLT 的 data.json 格式完全兼容
 * 封面颜色映射与桌面版一致
 */

const COVER_COLORS = {
  red: '#9c2f2a', gold: '#9a6b22', green: '#2f6b52',
  blue: '#2f5d8a', purple: '#6b3f8a', brown: '#7a4a2a',
  gray: '#4a4a4a', pink: '#b05a7a',
};

const COVER_NAMES = {
  red: '喜庆红', gold: '富贵金', green: '翠竹绿',
  blue: '天空蓝', purple: '优雅紫', brown: '檀木棕',
  gray: '墨玉灰', pink: '桃花粉',
};

/** 生成唯一 ID */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 创建一个空账本 */
function createBook(title, category, eventDate, cover, note) {
  return {
    id: genId(),
    title: title || '',
    category: category || '',
    event_date: eventDate || '',
    cover: cover || 'red',
    cover_image: '',
    note: note || '',
    photos: {},
    records: [],
  };
}

/** 创建一条记录 */
function createRecord(name, amount, ioType, date, note, pageNo, seq) {
  return {
    name: name || '',
    amount: parseFloat(amount) || 0,
    event: '',
    date: date || '',
    io_type: ioType || '收入',
    note: note || '',
    page_no: parseInt(pageNo) || 0,
    seq: parseInt(seq) || 0,
    marked: false,
  };
}

/** 计算账本总金额 */
function bookSumAmount(book) {
  return (book.records || []).reduce((s, r) => {
    return s + (r.io_type === '支出' ? -Math.abs(r.amount) : Math.abs(r.amount));
  }, 0);
}

/** 计算账本记录数 */
function bookRecordCount(book) {
  return (book.records || []).length;
}

/** 格式化金额显示 */
function formatAmount(amount) {
  if (!amount && amount !== 0) return '';
  const abs = Math.abs(amount);
  const formatted = abs % 1 === 0 ? abs.toLocaleString() : abs.toFixed(2);
  return amount < 0 ? '-¥' + formatted : '¥' + formatted;
}

/** 收集所有不重复的人名 */
function collectAllNames(books) {
  const names = new Set();
  for (const book of books) {
    for (const rec of (book.records || [])) {
      if (rec.name) names.add(rec.name);
    }
  }
  return [...names];
}

/** 按姓名搜索记录 */
function findRecordsByName(books, name) {
  const results = [];
  for (const book of books) {
    for (const rec of (book.records || [])) {
      if (rec.name === name) {
        results.push({ book, record: rec });
      }
    }
  }
  return results;
}
