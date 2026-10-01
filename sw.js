/// <reference lib="webworker" />
/**
 * Service Worker - 离线缓存
 * 缓存所有静态资源，让 PWA 完全离线可用
 */

var CACHE_NAME = 'gift-book-v12';
var STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './vendor/pinyin-pro.mjs',
  './vendor/jsQR.js',
  './vendor/pako.min.js',
  './js/db.js',
  './js/model.js',
  './js/pinyin.js',
  './js/shelf.js',
  './js/book.js',
  './js/search.js',
  './js/io.js',
  './js/qrscan.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// 安装：预缓存静态资源
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(STATIC_ASSETS); })
      .then(function() { return self.skipWaiting(); })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// 请求拦截
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // CDN 请求（pinyin-pro）缓存优先
  if (url.includes('cdn.jsdelivr.net') || url.includes('unpkg.com')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(resp) {
          if (resp.ok) {
            var clone = resp.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
          }
          return resp;
        });
      })
    );
    return;
  }

  // 本地资源：缓存优先，网络回退
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(resp) {
        if (resp.ok && e.request.method === 'GET') {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        }
        return resp;
      });
    })
  );
});
