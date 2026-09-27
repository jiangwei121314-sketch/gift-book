/**
 * 拼音匹配模块 - 与电脑版 suggest_group 逻辑对齐
 * 使用 pinyin-pro CDN 库
 */

// 声母/韵母易混组
const _FINAL_GROUPS = [['in','ing'],['en','eng'],['an','ang'],['ian','iang'],['uan','uang']];
const _INITIAL_GROUPS = [['zh','z'],['ch','c'],['sh','s'],['n','l'],['f','h']];

/** 获取汉字拼音（无声调） */
function getPinyin(char) {
  if (typeof pinyinPro !== 'undefined' && pinyinPro.pinyin) {
    return pinyinPro.pinyin(char, { toneType: 'none', type: 'array' });
  }
  // 降级：如果 CDN 未加载，返回原字符
  return [char];
}

/** 单个音节是否近似 */
function fuzzySyllable(a, b) {
  if (a === b) return true;
  const ia = a[0], ib = b[0];
  const fa = a.slice(1), fb = b.slice(1);
  const iniEq = ia === ib || _INITIAL_GROUPS.some(g => g.includes(ia) && g.includes(ib));
  const finEq = fa === fb || _FINAL_GROUPS.some(g => g.includes(fa) && g.includes(fb));
  return iniEq && finEq;
}

/**
 * 搜索疑似同名列表
 * 返回 [{name, type:'同音'|'音近'}, ...]
 */
function suggestGroup(targetName, allNames) {
  if (!targetName || !allNames || allNames.length === 0) return [];

  let targetPy;
  try {
    targetPy = getPinyin(targetName);
  } catch { return []; }

  const n = targetPy.length;
  const results = [];

  for (const other of allNames) {
    if (other === targetName) continue;

    let otherPy;
    try {
      otherPy = getPinyin(other);
    } catch { continue; }

    if (otherPy.length !== n) continue;

    // 统计完全匹配数
    let eq = 0;
    for (let i = 0; i < n; i++) {
      if (targetPy[i] === otherPy[i]) eq++;
    }

    if (eq === n) {
      results.push({ name: other, type: '同音' });
    } else if (n >= 2 && eq >= n - 1) {
      // 两字名：名字部分必须 fuzzy
      if (n === 2 && !fuzzySyllable(targetPy[1], otherPy[1])) continue;
      results.push({ name: other, type: '音近' });
    } else if (n >= 2) {
      // 每个字拼音都近似
      let allFuzzy = true;
      for (let i = 0; i < n; i++) {
        if (!fuzzySyllable(targetPy[i], otherPy[i])) {
          allFuzzy = false;
          break;
        }
      }
      if (allFuzzy) results.push({ name: other, type: '音近' });
    }
  }
  return results;
}
