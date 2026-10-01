/**
 * 公历转农历工具（支持 1900-2100，与桌面端 lunar_util.py 同源）
 *
 * 全局函数 lunarLabel(dateText)，返回如：
 *   「农历六月初十」「农历正月十五」「农历闰二月初一」
 * 无法换算时返回空串。
 */
(function () {
  // 每年农历信息位表（1900 起），权威数据（含 2033 修正）
  var LUNAR_INFO = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0,
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f252,
    0x0d520
  ];

  var MONTH_CN = ['正', '二', '三', '四', '五', '六',
                  '七', '八', '九', '十', '冬', '腊'];
  var DAY_CN = [
    '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
  ];

  var MS_DAY = 86400000;

  function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
  function leapDays(y) {
    if (leapMonth(y)) return (LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29;
    return 0;
  }
  function yearDays(y) {
    var total = 348, info = LUNAR_INFO[y - 1900];
    for (var bit = 0x8000; bit > 0x8; bit >>= 1) {
      if (info & bit) total++;
    }
    return total + leapDays(y);
  }
  function monthDays(y, m) {
    return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29;
  }

  /** 公历 → {y,m,d,leap}；超出范围返回 null */
  function solarToLunar(y, m, d) {
    if (y < 1900 || y > 2100) return null;
    var offset = Math.floor(
      (Date.UTC(y, m - 1, d) - Date.UTC(1900, 0, 31)) / MS_DAY);
    if (offset < 0) return null;

    var ly = 1900, yd;
    while (ly < 2101) {
      yd = yearDays(ly);
      if (offset < yd) break;
      offset -= yd;
      ly++;
    }

    var leap = leapMonth(ly);
    var isLeap = false;
    var lm = 1, md;
    while (lm <= 12) {
      // 闰月插在对应平月之后：先消费闰月，再消费同号平月
      if (leap > 0 && lm === leap + 1 && !isLeap) {
        md = leapDays(ly);
        isLeap = true;
        if (offset < md) return { y: ly, m: leap, d: offset + 1, leap: true };
        offset -= md;
        continue; // 不递增月份号：下一轮消费正常 leap 月
      }
      md = monthDays(ly, lm);
      if (isLeap) isLeap = false;
      if (offset < md) return { y: ly, m: lm, d: offset + 1, leap: false };
      offset -= md;
      lm++;
    }
    return { y: ly, m: lm, d: offset + 1, leap: isLeap };
  }

  /** 解析「2021年07月19日」/「2021-7-19」→ [年,月,日]；无法解析返回 null */
  function parseCnDate(text) {
    if (!text) return null;
    var m = String(text).match(/(\d{4,5})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!m) return null;
    var y = m[1];
    if (y.length === 5) y = y.slice(0, 4); // 兼容误录 20226 → 2022
    var year = parseInt(y, 10), mo = parseInt(m[2], 10), da = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    return [year, mo, da];
  }

  /** 账本日期文本 → 「农历六月初十」；无法转换返回空串 */
  function lunarLabel(text) {
    var parsed = parseCnDate(text);
    if (!parsed) return '';
    var r = solarToLunar(parsed[0], parsed[1], parsed[2]);
    if (!r) return '';
    return '农历' + (r.leap ? '闰' : '') + MONTH_CN[r.m - 1] + '月' +
           DAY_CN[r.d - 1];
  }

  window.lunarLabel = lunarLabel;
})();
