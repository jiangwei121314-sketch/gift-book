/**
 * 拼音匹配模块 - 与电脑版 suggest_group 逻辑对齐
 * 使用 pinyin-pro UMD 版（暴露全局变量 pinyinPro）
 */

// 声母/韵母易混组
var _FINAL_GROUPS = [['in','ing'],['en','eng'],['an','ang'],['ian','iang'],['uan','uang']];
var _INITIAL_GROUPS = [['zh','z'],['ch','c'],['sh','s'],['n','l'],['f','h']];

/** 获取汉字拼音数组（无声调） */
function getPinyin(char) {
  // pinyinPro UMD 版暴露 pinyinPro.pinyin()
  if (typeof pinyinPro !== 'undefined' && pinyinPro.pinyin) {
    return pinyinPro.pinyin(char, { toneType: 'none', type: 'array' });
  }
  // 降级：返回原字符
  return [char];
}

/** 单个音节是否近似 */
function fuzzySyllable(a, b) {
  if (a === b) return true;
  var ia = a[0], ib = b[0];
  var fa = a.slice(1), fb = b.slice(1);
  var iniEq = ia === ib || _INITIAL_GROUPS.some(function(g) { return g.indexOf(ia) >= 0 && g.indexOf(ib) >= 0; });
  var finEq = fa === fb || _FINAL_GROUPS.some(function(g) { return g.indexOf(fa) >= 0 && g.indexOf(fb) >= 0; });
  return iniEq && finEq;
}

/**
 * 搜索疑似同名列表
 * 返回 [{name, type:'同音'|'音近'}, ...]
 */
function suggestGroup(targetName, allNames) {
  if (!targetName || !allNames || allNames.length === 0) return [];

  var targetPy;
  try {
    targetPy = getPinyin(targetName);
  } catch (e) { return []; }

  var n = targetPy.length;
  var results = [];

  for (var i = 0; i < allNames.length; i++) {
    var other = allNames[i];
    if (other === targetName) continue;

    var otherPy;
    try {
      otherPy = getPinyin(other);
    } catch (e) { continue; }

    if (otherPy.length !== n) continue;

    var eq = 0;
    for (var j = 0; j < n; j++) {
      if (targetPy[j] === otherPy[j]) eq++;
    }

    if (eq === n) {
      results.push({ name: other, type: '同音' });
    } else if (n >= 2 && eq >= n - 1) {
      if (n === 2 && !fuzzySyllable(targetPy[1], otherPy[1])) continue;
      results.push({ name: other, type: '音近' });
    } else if (n >= 2) {
      var allFuzzy = true;
      for (var j = 0; j < n; j++) {
        if (!fuzzySyllable(targetPy[j], otherPy[j])) {
          allFuzzy = false;
          break;
        }
      }
      if (allFuzzy) results.push({ name: other, type: '音近' });
    }
  }
  return results;
}
