// 레시피 서랍 서비스 워커
// - 앱 화면(같은 사이트 파일)은 인터넷이 없어도 열리도록 저장해 둠
// - index.html은 항상 새 버전을 먼저 시도하고, 안 되면 저장본 사용
// - 구글 웹앱(레시피 데이터) 요청은 건드리지 않음
const CACHE = 'recipe-drawer-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 유튜브 썸네일: 한 번 본 건 저장해 두고 재사용
  if (url.hostname === 'i.ytimg.com') {
    e.respondWith(
      caches.open(CACHE + '-thumbs').then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      }).catch(() => fetch(req))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // 화면 이동(공유로 들어온 ?share=… 포함): 새 버전 먼저, 실패하면 저장본
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // 나머지 파일: 저장본 먼저, 없으면 내려받기
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
