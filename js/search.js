/**
 * 人物搜索页 - 对齐电脑版：精确匹配 > 连续包含 > 字序包含 + 同音/音近
 */

/** 判断 query 是否是 name 的子序列（每个字按顺序出现在 name 中） */
function isSubsequence(query, name) {
  var qi = 0;
  for (var i = 0; i < name.length && qi < query.length; i++) {
    if (name[i] === query[qi]) qi++;
  }
  return qi === query.length;
}

/** 聚合某名字在所有账本中的记录 */
function collectEntries(books, name) {
  var entries = [];
  books.forEach(function(b) {
    (b.records || []).forEach(function(r) {
      if (r.name === name) {
        entries.push({
          date: r.date || b.event_date || '',
          event: r.event || b.category || '',
          amount: r.amount,
          note: r.note || '',
          bookId: b.id,
          pageNo: r.page_no || 0
        });
      }
    });
  });
  entries.sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  return entries;
}

/** 执行搜索（页面渲染；历史栈由 navSearch / 疑似卡跳转负责） */
function performSearch(keyword) {
  keyword = keyword || '';
  var container = document.getElementById('search-results');
  var clearBtn = document.getElementById('btn-search-clear');

  clearBtn.style.display = keyword ? 'flex' : 'none';

  if (!keyword || !keyword.trim()) {
    container.innerHTML = '<div class="search-empty">请输入要查找的人名，可搜全名或名字中的一个字</div>';
    return;
  }

  keyword = keyword.trim();
  var allNames = collectAllNames(AppState.books);

  // 1. 精确匹配
  var exact = allNames.filter(function(n) { return n === keyword; });

  // 2. 连续包含
  var substr = allNames.filter(function(n) { return n !== keyword && n.indexOf(keyword) >= 0; });

  // 3. 字序包含
  var subseq = allNames.filter(function(n) {
    return n !== keyword && n.indexOf(keyword) < 0 && isSubsequence(keyword, n);
  });

  // 确定主人物
  var main = '';
  if (exact.length > 0) main = exact[0];
  else if (substr.length > 0) main = substr[0];
  else if (subseq.length > 0) main = subseq[0];

  if (!main) {
    container.innerHTML = '<div class="search-empty">没有找到名字包含"' + escapeHtml(keyword) + '"用字的人情记录</div>';
    return;
  }

  // 剩余候选
  if (main === substr[0]) substr = substr.slice(1);
  if (main === subseq[0]) subseq = subseq.slice(1);

  var html = '';

  // 主人物卡
  html += buildMainCard(main);

  // 疑似人物
  html += buildMaybeCards(main, substr, subseq, allNames);

  container.innerHTML = html;

  // 绑定主人物时间线跳转
  container.querySelectorAll('.timeline-item').forEach(function(row) {
    row.addEventListener('click', function() {
      var bookId = row.dataset.bookId;
      var pageNo = parseInt(row.dataset.pageNo) || 0;
      if (bookId) {
        var startPage = Math.max(0,
          Math.floor((pageNo - 1) / BookState.rowsPerPage));
        openBook(bookId, 'person', startPage);
      }
    });
  });

  // 绑定疑似卡片点击：写入新的历史（系统返回/边缘手势可回到上一个搜索）
  container.querySelectorAll('.maybe-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var name = card.dataset.name;
      if (name) {
        document.getElementById('search-input').value = name;
        document.getElementById('btn-search-clear').style.display = 'flex';
        performSearch(name);
        history.pushState({ p: 'search', q: name }, '');
      }
    });
  });
}

/** 构建主人物卡 */
function buildMainCard(name) {
  var entries = collectEntries(AppState.books, name);
  var income = 0, outcome = 0;
  entries.forEach(function(e) {
    if (e.amount > 0) income += e.amount;
    else outcome += e.amount;
  });
  var net = income + outcome;
  var booksSet = {};
  entries.forEach(function(e) { booksSet[e.event] = true; });

  var timelineHtml = entries.map(function(e, i) {
    var isExpense = e.amount < 0;
    var dotCls = isExpense ? 'expense' : '';
    var amountCls = isExpense ? 'expense' : 'income';
    var amount = formatAmount(e.amount);
    var isLast = i === entries.length - 1;
    return '<div class="timeline-item" data-book-id="' + e.bookId + '" data-page-no="' + e.pageNo + '">' +
      '<div class="timeline-rail">' +
        '<div class="timeline-dot ' + dotCls + '"></div>' +
        (isLast ? '' : '<div class="timeline-line"></div>') +
      '</div>' +
      '<div class="timeline-content">' +
        '<div class="timeline-row-date">' + escapeHtml(e.date) + '</div>' +
        '<div class="timeline-row-event">' + escapeHtml(e.event) + (e.note ? ' · ' + escapeHtml(e.note) : '') + '</div>' +
        '<div class="timeline-row-amount ' + amountCls + '">' + amount + '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  return '<div class="person-main-card">' +
    '<div class="person-main-head">' +
      '<span class="person-main-name">' + escapeHtml(name) + '</span>' +
      '<span class="person-main-sub">' + entries.length + ' 笔往来 · 涉及 ' + Object.keys(booksSet).length + ' 个事项</span>' +
    '</div>' +
    '<div class="person-stats">' +
      '<div class="stat-cell"><div class="stat-label">对方送来</div><div class="stat-value income">' + formatAmount(income) + '</div></div>' +
      '<div class="stat-cell"><div class="stat-label">我方支出</div><div class="stat-value expense">' + formatAmount(Math.abs(outcome)) + '</div></div>' +
      '<div class="stat-cell"><div class="stat-label">净往来</div><div class="stat-value ' + (net < 0 ? 'expense' : 'income') + '">' + formatAmount(net) + '</div></div>' +
    '</div>' +
    '<div class="timeline-title">往来时间线（点击跳转对应账本）</div>' +
    '<div class="timeline-list">' + timelineHtml + '</div>' +
  '</div>';
}

/** 构建疑似人物卡 */
function buildMaybeCards(main, substr, subseq, allNames) {
  // 拼音匹配
  var suggestions = [];
  try {
    if (typeof suggestGroup === 'function') {
      var otherNames = allNames.filter(function(n) { return n !== main; });
      suggestions = suggestGroup(main, otherNames);
    }
  } catch (e) {}

  // 合并所有疑似
  var seen = {};
  seen[main] = true;
  var candidates = [];

  // 同音/音近
  suggestions.forEach(function(s) {
    if (!seen[s.name]) {
      seen[s.name] = true;
      candidates.push({ name: s.name, relation: s.type });
    }
  });
  // 名字包含
  substr.forEach(function(n) {
    if (!seen[n]) { seen[n] = true; candidates.push({ name: n, relation: '名字包含' }); }
  });
  // 用字相同
  subseq.forEach(function(n) {
    if (!seen[n]) { seen[n] = true; candidates.push({ name: n, relation: '用字相同' }); }
  });

  // 只保留有记录的
  candidates = candidates.filter(function(c) {
    return collectEntries(AppState.books, c.name).length > 0;
  });

  if (candidates.length === 0) return '';

  var html = '<div class="maybe-section-title">可能是这个人（名字读音相近或用字相同，登记可能出现异字）</div>';

  candidates.forEach(function(c) {
    var entries = collectEntries(AppState.books, c.name);
    var income = 0, outcome = 0;
    entries.forEach(function(e) {
      if (e.amount > 0) income += e.amount;
      else outcome += e.amount;
    });
    var net = income + outcome;

    var badgeCls = '';
    if (c.relation === '同音') badgeCls = 'homophone';
    else if (c.relation === '音近') badgeCls = 'similar';
    else if (c.relation === '名字包含') badgeCls = 'contains';
    else badgeCls = 'subseq';

    // 迷你时间线（最多3条）
    var previewHtml = entries.slice(0, 3).map(function(e) {
      var amountCls = e.amount < 0 ? 'expense' : 'income';
      return '<div class="maybe-preview-row">' +
        '<span class="maybe-preview-date">' + escapeHtml(e.date) + '</span>' +
        '<span class="maybe-preview-event">' + escapeHtml(e.event) + '</span>' +
        '<span class="maybe-preview-amount ' + amountCls + '">' + formatAmount(e.amount) + '</span>' +
      '</div>';
    }).join('');

    if (entries.length > 3) {
      previewHtml += '<div class="maybe-card-info">…还有 ' + (entries.length - 3) + ' 笔，点击卡片查看全部时间线</div>';
    }

    html += '<div class="maybe-card" data-name="' + escapeHtml(c.name) + '">' +
      '<div class="maybe-card-head">' +
        '<span class="maybe-card-name">' + escapeHtml(c.name) + '</span>' +
        '<span class="maybe-badge ' + badgeCls + '">' + c.relation + '</span>' +
      '</div>' +
      '<div class="maybe-card-info">' + entries.length + ' 笔往来 · 净' + formatAmount(net) + '</div>' +
      previewHtml +
    '</div>';
  });

  return html;
}
