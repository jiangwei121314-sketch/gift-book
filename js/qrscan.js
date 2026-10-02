/**
 * 扫一扫导入（PWA 端）
 * - 调用后置相机，jsQR 连续识别动画二维码，自动收集分片
 * - 支持从相册选择二维码图片（可多选），电脑不在身边也能识别截图
 * - 全部收齐 → base64 拼接 → pako 解压 → JSON → importDataObject
 * 与电脑端 modules/gift_book/qr_sync.py 的帧格式对应：
 *   GB1|<总片数>|<序号>|<base64>
 */
var QrScan = (function() {
  var FRAME_RE = /^GB1\|(\d+)\|(\d+)\|([A-Za-z0-9+/=]+)$/;
  var TUNNEL_RE = /^GBT\|(https:\/\/\S+)$/;

  var _stream = null;
  var _raf = null;
  var _running = false;
  var _chunks = {};
  var _total = null;
  var _lastToastAt = 0;

  /** UTF-8 字节数组转字符串（兼容旧系统，不依赖 TextDecoder） */
  function u8ToString(u8) {
    var s = '';
    var i = 0;
    while (i < u8.length) {
      var b1 = u8[i++];
      var cp;
      if (b1 < 0x80) {
        cp = b1;
      } else if (b1 < 0xE0) {
        cp = ((b1 & 0x1F) << 6) | (u8[i++] & 0x3F);
      } else if (b1 < 0xF0) {
        cp = ((b1 & 0x0F) << 12) | ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F);
      } else {
        cp = ((b1 & 0x07) << 18) | ((u8[i++] & 0x3F) << 12) |
             ((u8[i++] & 0x3F) << 6) | (u8[i++] & 0x3F);
      }
      if (cp < 0x10000) {
        s += String.fromCharCode(cp);
      } else {
        cp -= 0x10000;
        s += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
      }
    }
    return s;
  }

  /** 打开扫码弹窗 */
  function openScan() {
    resetState();
    document.getElementById('qr-video').style.display = '';
    var modal = document.getElementById('modal-qrscan');
    modal.style.display = 'flex';
    startCamera();
  }

  /** 关闭并释放相机 */
  function closeScan() {
    stopCamera();
    document.getElementById('modal-qrscan').style.display = 'none';
  }

  function resetState() {
    _chunks = {};
    _total = null;
    _importing = false;
    updateProgress();
    var status = document.getElementById('qr-status');
    status.textContent = '将二维码对准取景框，自动连续扫描';
    // 相机不在运行 → 恢复取景画面并尝试重新启动
    var video = document.getElementById('qr-video');
    if (!_stream) {
      video.style.display = '';
      document.getElementById('qr-cam-fail').style.display = 'none';
      startCamera();
    }
  }

  function startCamera() {
    var video = document.getElementById('qr-video');
    var camFail = document.getElementById('qr-cam-fail');
    camFail.style.display = 'none';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCamFail('当前环境不支持相机，请用「从相册选二维码图片」');
      return;
    }

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    }).then(function(stream) {
      _stream = stream;
      video.srcObject = stream;
      video.setAttribute('playsinline', true);
      video.play();
      _running = true;
      _raf = requestAnimationFrame(tick);
    }).catch(function(err) {
      var name = err && err.name ? err.name : '';
      var standalone = (window.navigator.standalone === true) ||
        (window.matchMedia &&
         window.matchMedia('(display-mode: standalone)').matches);
      var msg;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        if (standalone) {
          msg = '主屏幕模式相机被拒绝（权限与浏览器独立）。修复：①先用浏览器(Safari/Chrome)打开本网站 ②点扫一扫并选择允许相机 ③删掉主屏幕旧图标重新「添加到主屏幕」（苹果需iOS 14.5以上）。临时可用下方「相册选二维码」';
        } else {
          msg = '相机权限被拒绝。请在手机设置中允许（苹果：设置→Safari→相机；安卓：设置→应用→浏览器→权限→相机），然后点「重新扫描」';
        }
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        msg = '未检测到相机设备，可改用「从相册选二维码图片」';
      } else if (name === 'NotReadableError') {
        msg = '相机被其他应用占用，请关掉手电筒/相机/视频应用后点「重新扫描」';
      } else if (window.isSecureContext === false) {
        msg = '当前网址不是安全连接（需 https:// 开头），相机被禁用。请用 GitHub 的 https 网址打开';
      } else {
        msg = '无法打开相机（' + name + '），可改用「从相册选二维码图片」';
      }
      showCamFail(msg);
    });
  }

  function showCamFail(msg) {
    var camFail = document.getElementById('qr-cam-fail');
    camFail.textContent = msg;
    camFail.style.display = 'block';
    document.getElementById('qr-video').style.display = 'none';
  }

  function stopCamera() {
    _running = false;
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    if (_stream) {
      _stream.getTracks().forEach(function(t) { t.stop(); });
      _stream = null;
    }
    var video = document.getElementById('qr-video');
    if (video) video.srcObject = null;
  }

  /** 相机取帧循环 */
  function tick() {
    if (!_running) return;
    var video = document.getElementById('qr-video');
    var canvas = document.getElementById('qr-canvas');
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      var w = video.videoWidth;
      var h = video.videoHeight;
      if (w && h) {
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, w, h);
        var imgData = ctx.getImageData(0, 0, w, h);
        try {
          var code = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code && code.data) handleCode(code.data);
        } catch (e) { /* 单帧解码异常，忽略继续 */ }
      }
    }
    _raf = requestAnimationFrame(tick);
  }

  var _importing = false;

  var MAX_ATTEMPTS = 7;

  /** 网址码（GBT）：停止相机 → 从临时云通道下载含照片数据 → 导入
   * 网络层失败自动重试最多 7 次（国内访问临时通道握手常被间歇重置）。 */
  function fetchAndImport(url, attempt) {
    if (attempt === undefined) attempt = 1;
    if (_importing && attempt === 1) return;
    _importing = true;
    stopCamera();
    var status = document.getElementById('qr-status');
    status.textContent = attempt === 1
      ? '已识别，正在下载含照片数据（约十几秒，请勿关闭）…'
      : '网络连接不稳，正在自动重试（第 ' + attempt + '/' + MAX_ATTEMPTS +
        ' 次）…';

    var timeoutP = new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('下载超时')); }, 45000);
    });

    Promise.race([fetch(url, { cache: 'no-store' }), timeoutP])
      .then(function(resp) {
        if (!resp.ok) throw new Error('服务器返回 ' + resp.status);
        return resp.json();
      })
      .then(function(data) {
        return importDataObject(data);
      })
      .then(function(n) {
        _importing = false;
        closeScan();
        renderShelf();
        showPage('page-shelf');
        showToast('扫码秒传成功：' + n + ' 本账本（含照片）');
      })
      .catch(function(e) {
        var msg = (e && e.message) ? e.message : String(e);
        var networkFail = msg.indexOf('Failed to fetch') >= 0 ||
                          msg.indexOf('NetworkError') >= 0 ||
                          msg.indexOf('Load failed') >= 0; // iOS WebKit 文案
        // 网络层失败且还有重试机会：1.5 秒后自动重试
        if (networkFail && attempt < MAX_ATTEMPTS) {
          status.textContent = '网络连接被干扰，1.5 秒后自动重试（第 ' +
            (attempt + 1) + '/' + MAX_ATTEMPTS + ' 次）…';
          setTimeout(function() { fetchAndImport(url, attempt + 1); }, 1500);
          return;
        }
        _importing = false;
        var hint;
        if (networkFail) {
          hint = '手机网络无法连接临时通道。建议：① WiFi 和手机流量互换后' +
                 '重新扫码；② 确认电脑上的二维码窗口没有关闭；' +
                 '③ 仍不行就改用「导出手机版数据（JSON）」发文件导入';
        } else if (msg === '下载超时') {
          hint = '临时通道响应超时（网络太慢）。建议 WiFi 与手机流量互换，' +
                 '或改用「导出手机版数据（JSON）」文件方式';
        } else {
          hint = '下载失败：' + msg + '。请重新生成二维码或改用 JSON 文件';
        }
        status.textContent = hint;
      });
  }

  /** 处理一个识别到的字符串（相机 / 相册共用）。返回是否为本格式帧。 */
  function handleCode(text) {
    var tm = TUNNEL_RE.exec(text);
    if (tm) {
      fetchAndImport(tm[1]);
      return true;
    }

    var m = FRAME_RE.exec(text);
    if (!m) {
      var now = Date.now();
      if (now - _lastToastAt > 1500) {
        _lastToastAt = now;
        showToast('不是人情簿数据二维码');
      }
      return false;
    }

    var total = parseInt(m[1], 10);
    var idx = parseInt(m[2], 10);
    var payload = m[3];

    if (_total === null) _total = total;
    if (total !== _total) {
      showToast('二维码批次不一致，请点「重新扫描」');
      return false;
    }

    if (!_chunks[idx]) {
      _chunks[idx] = payload;
      updateProgress();
      if (countChunks() === _total) {
        finalize();
      }
    }
    return true;
  }

  function countChunks() {
    var n = 0;
    for (var k in _chunks) {
      if (Object.prototype.hasOwnProperty.call(_chunks, k)) n++;
    }
    return n;
  }

  function updateProgress() {
    var got = countChunks();
    var fill = document.getElementById('qr-progress-fill');
    var text = document.getElementById('qr-progress-text');
    var pct = _total ? Math.round(got / _total * 100) : 0;
    fill.style.width = pct + '%';
    text.textContent = _total ? ('已扫描 ' + got + ' / ' + _total) : '尚未扫描';
  }

  /** 收齐 → 拼接 → 解压 → 导入 */
  function finalize() {
    stopCamera();
    var status = document.getElementById('qr-status');
    status.textContent = '扫描完成，正在导入…';

    var b64 = '';
    for (var i = 0; i < _total; i++) b64 += _chunks[i];

    var binStr;
    try {
      binStr = atob(b64);
    } catch (e) {
      status.textContent = '数据损坏，请重新扫描';
      return;
    }
    var bytes = new Uint8Array(binStr.length);
    for (var j = 0; j < binStr.length; j++) bytes[j] = binStr.charCodeAt(j);

    var jsonText;
    try {
      var inflated = pako.inflate(bytes);
      jsonText = u8ToString(inflated);
    } catch (e) {
      status.textContent = '解压失败，请重新扫描';
      return;
    }

    var data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      status.textContent = '数据解析失败，请重新扫描';
      return;
    }

    importDataObject(data).then(function(n) {
      closeScan();
      renderShelf();
      showPage('page-shelf');
      showToast('扫码导入成功：' + n + ' 本账本');
    }).catch(function(e) {
      status.textContent = '导入失败：' + (e && e.message ? e.message : '');
    });
  }

  /** 从相册选择图片（支持多选），逐张解码 */
  function pickImages(files) {
    var list = [];
    for (var i = 0; i < files.length; i++) list.push(files[i]);
    if (!list.length) return;

    var okCount = 0;
    function next() {
      if (!list.length) {
        if (!okCount) showToast('图片中没有识别到人情簿二维码');
        return;
      }
      decodeImage(list.shift()).then(function(matched) {
        if (matched) okCount++;
        next();
      });
    }
    next();
  }

  function decodeImage(file) {
    return new Promise(function(resolve) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          var cctx = canvas.getContext('2d', { willReadFrequently: true });
          cctx.drawImage(img, 0, 0);
          var data = cctx.getImageData(0, 0, canvas.width, canvas.height);
          var matched = false;
          try {
            var code = jsQR(data.data, canvas.width, canvas.height,
                            { inversionAttempts: 'attemptBoth' });
            if (code && code.data) matched = handleCode(code.data);
          } catch (err) { /* 忽略坏图 */ }
          resolve(matched);
        };
        img.onerror = function() { resolve(false); };
        img.src = e.target.result;
      };
      reader.onerror = function() { resolve(false); };
      reader.readAsDataURL(file);
    });
  }

  return {
    open: openScan,
    close: closeScan,
    reset: function() { resetState(); },
    pickImages: pickImages,
  };
})();
