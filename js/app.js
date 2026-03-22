// URLパラメータ取得
function getParam(key) {
  return new URLSearchParams(location.search).get(key);
}

// ===== index.html: 小説一覧 =====
async function loadNovelList() {
  const container = document.getElementById('novel-list');
  try {
    const res = await fetch('novels/index.json');
    const novels = await res.json();

    if (novels.length === 0) {
      container.innerHTML = '<p style="color:#888;text-align:center;padding:40px">小説がまだありません</p>';
      return;
    }

    container.innerHTML = novels.map(n => `
      <div class="novel-card" onclick="location.href='novel.html?id=${n.id}'">
        <div class="novel-card-header">
          <div class="novel-card-title">${n.title}</div>
          <span class="novel-status ${n.status === '完結' ? 'completed' : 'ongoing'}">${n.status}</span>
        </div>
        <div class="novel-card-meta">
          <span>作者：${n.author}</span>
          <span>ジャンル：${n.genre}</span>
          <span>${n.chapterCount}話</span>
          <span>更新：${n.updatedAt}</span>
        </div>
        <div class="novel-card-description">${n.description}</div>
        <div class="novel-tags">
          ${(n.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="error-box">読み込みに失敗しました。<br><small>python -m http.server でサーバーを起動してください</small></div>`;
  }
}

// ===== novel.html: 小説詳細・目次 =====
async function loadNovelDetail() {
  const id = getParam('id');
  const container = document.getElementById('novel-detail');

  try {
    // index.jsonからfile名を取得
    const idxRes = await fetch('novels/index.json');
    const index = await idxRes.json();
    const entry = index.find(n => n.id === id);
    if (!entry) throw new Error('not found');

    const res = await fetch(`novels/${entry.file}`);
    const novel = await res.json();

    document.title = novel.title + ' - 小説リーダー';
    document.getElementById('breadcrumb-title').textContent = novel.title;

    container.innerHTML = `
      <div class="page-header">
        <div class="novel-title-large">${novel.title}</div>
        <div class="novel-meta-row">
          <span>作者：${novel.author}</span>
          <span>ジャンル：${novel.genre}</span>
          <span class="novel-status ${novel.status === '完結' ? 'completed' : 'ongoing'}">${novel.status}</span>
          <span>更新：${novel.updatedAt}</span>
        </div>
        <div class="novel-tags" style="margin-bottom:0">
          ${(novel.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
        <div class="novel-description-full">${novel.description}</div>
      </div>

      <div class="section-title">目次（全${novel.chapters.length}話）</div>
      <div class="toc-list">
        ${novel.chapters.map(ch => `
          <a class="toc-item" href="chapter.html?id=${novel.id}&ch=${ch.id}">
            <span class="toc-num">${ch.id}</span>
            <span class="toc-title">${ch.title}</span>
            <span class="toc-date">${ch.updatedAt || ''}</span>
          </a>
        `).join('')}
      </div>
    `;
  } catch (e) {
    container.innerHTML = `<div class="error-box">小説が見つかりませんでした</div>`;
  }
}

// ===== chapter.html: 読書 =====
let currentNovel = null;
let currentChapterId = null;
let fontSize = 0; // -2〜+3
let isVertical = false;

const fontSizeLabels = ['極小', '小', '標準', '大', '特大', '最大'];
const fontSizeValues = ['0.85rem', '0.95rem', '1.05rem', '1.2rem', '1.35rem', '1.5rem'];
// fontSize=0 → index 2 (標準)

async function loadChapter() {
  const novelId = getParam('id');
  const chId = parseInt(getParam('ch'));
  const container = document.getElementById('chapter-content');

  try {
    const idxRes = await fetch('novels/index.json');
    const index = await idxRes.json();
    const entry = index.find(n => n.id === novelId);
    if (!entry) throw new Error('not found');

    const res = await fetch(`novels/${entry.file}`);
    currentNovel = await res.json();
    currentChapterId = chId;

    const chapter = currentNovel.chapters.find(c => c.id === chId);
    if (!chapter) throw new Error('chapter not found');

    document.title = chapter.title + ' - ' + currentNovel.title;

    // パンくず
    const bcNovel = document.getElementById('breadcrumb-novel');
    bcNovel.textContent = currentNovel.title;
    bcNovel.href = `novel.html?id=${novelId}`;
    document.getElementById('breadcrumb-chapter').textContent = chapter.title;

    // 前後話
    const chapters = currentNovel.chapters;
    const idx = chapters.findIndex(c => c.id === chId);
    const prev = idx > 0 ? chapters[idx - 1] : null;
    const next = idx < chapters.length - 1 ? chapters[idx + 1] : null;

    container.innerHTML = `
      <div class="chapter-header">
        <div class="chapter-novel-title"><a href="novel.html?id=${novelId}">${currentNovel.title}</a></div>
        <div class="chapter-title">${chapter.title}</div>
      </div>
      <div class="chapter-body" id="chapter-body">
        <div class="chapter-text" id="chapter-text">${escapeHtml(chapter.content)}</div>
      </div>
      <div class="chapter-nav">
        <a class="nav-btn ${prev ? '' : 'disabled'}" ${prev ? `href="chapter.html?id=${novelId}&ch=${prev.id}"` : ''}>
          ◀ 前の話
        </a>
        <a class="nav-btn nav-btn-toc" href="novel.html?id=${novelId}">目次</a>
        <a class="nav-btn ${next ? '' : 'disabled'}" ${next ? `href="chapter.html?id=${novelId}&ch=${next.id}"` : ''}>
          次の話 ▶
        </a>
      </div>
    `;

    document.getElementById('reading-settings').style.display = 'flex';
    initSettings();
  } catch (e) {
    container.innerHTML = `<div class="error-box">章が見つかりませんでした</div>`;
  }
}

function initSettings() {
  const fontUp = document.getElementById('font-up');
  const fontDown = document.getElementById('font-down');
  const display = document.getElementById('font-size-display');
  const vToggle = document.getElementById('vertical-toggle');

  function updateFont() {
    const i = fontSize + 2; // offset: 標準=index2
    document.getElementById('chapter-text').style.fontSize = fontSizeValues[i];
    display.textContent = fontSizeLabels[i];
    fontUp.disabled = (fontSize >= 3);
    fontDown.disabled = (fontSize <= -2);
  }

  fontUp.addEventListener('click', () => { if (fontSize < 3) { fontSize++; updateFont(); } });
  fontDown.addEventListener('click', () => { if (fontSize > -2) { fontSize--; updateFont(); } });

  vToggle.addEventListener('click', () => {
    isVertical = !isVertical;
    const body = document.getElementById('chapter-body');
    body.classList.toggle('vertical', isVertical);
    vToggle.textContent = isVertical ? 'ON' : 'OFF';
    vToggle.classList.toggle('active', isVertical);
  });

  updateFont();
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
