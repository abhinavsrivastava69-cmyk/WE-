pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── DOM refs ──
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const processing = document.getElementById('processing');
const processingTitle = document.getElementById('processingTitle');
const processingSubtitle = document.getElementById('processingSubtitle');
const progressFill = document.getElementById('progressFill');
const filterBar = document.getElementById('filterBar');
const feed = document.getElementById('feed');
const feedGrid = document.getElementById('feedGrid');
const sourceInfo = document.getElementById('sourceInfo');
const emptyState = document.getElementById('emptyState');
const newUploadBtn = document.getElementById('newUploadBtn');

let allPosts = [];
let currentFilter = 'all';
let likedPosts = new Set();
let bookmarkedPosts = new Set();

// ── Upload interactions ──
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    handleFile(file);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
});

newUploadBtn.addEventListener('click', resetToUpload);

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderPosts();
  });
});

// ── State helpers ──
function resetToUpload() {
  allPosts = [];
  currentFilter = 'all';
  fileInput.value = '';
  uploadSection.hidden = false;
  uploadArea.hidden = false;
  processing.hidden = true;
  filterBar.hidden = true;
  feed.hidden = true;
  emptyState.hidden = true;
  feedGrid.innerHTML = '';
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-filter="all"]').classList.add('active');
}

function updateProcessing({ title, subtitle, progress }) {
  processingTitle.textContent = title;
  processingSubtitle.textContent = subtitle;
  progressFill.style.width = progress + '%';
}

// ── PDF extraction (runs entirely in the browser) ──
async function extractTextFromPDF(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  let fullText = '';

  for (let i = 1; i <= totalPages; i++) {
    if (i % 20 === 0) {
      updateProcessing({
        title: `Reading page ${i} of ${totalPages}...`,
        subtitle: `${Math.round((i / totalPages) * 100)}% done`,
        progress: Math.round((i / totalPages) * 60)
      });
    }
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }

  return { text: fullText, numPages: totalPages };
}

// ── Content processing ──
const CATEGORY_KEYWORDS = {
  funny: [
    'joke','humor','laugh','funny','comedy','hilarious','wit',
    'sarcasm','irony','pun','satire','absurd','ridiculous',
    'amusing','comical','giggle','chuckle','fool','silly',
    'nonsense','parody','mock','haha','lol','rofl'
  ],
  learning: [
    'learn','study','research','theory','principle','concept',
    'method','technique','strategy','framework','approach',
    'lesson','education','knowledge','understand','discover',
    'experiment','hypothesis','analysis','insight','skill',
    'practice','master','develop','improve','growth','teach',
    'science','mathematical','formula','equation','theorem',
    'chapter','exercise','definition','rule','step'
  ],
  information: [
    'report','data','statistic','fact','news','update',
    'announce','according','survey','percent','million',
    'billion','government','policy','economy','market',
    'industry','company','organization','country','world',
    'global','national','international','official','source',
    'history','event','date','year','century','population'
  ]
};

function categorizeText(text) {
  const lower = text.toLowerCase();
  const scores = { funny: 0, learning: 0, information: 0 };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp('\\b' + keyword + '\\b', 'gi');
      const matches = lower.match(regex);
      if (matches) scores[category] += matches.length;
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'information';

  return Object.entries(scores).reduce(
    (a, b) => (b[1] > a[1] ? b : a),
    ['information', 0]
  )[0];
}

function extractQuotes(text) {
  const quotes = [];
  const patterns = [
    /[“”„""]([^"“”„]{20,200})[“”„""]/g,
    /[‘’‚'']([^'‘’‚]{20,200})[‘’‚'']/g,
  ];
  for (const p of patterns) {
    let m;
    while ((m = p.exec(text)) !== null) quotes.push(m[1].trim());
  }
  return quotes;
}

function splitIntoSentences(text) {
  return text
    .replace(/([.!?])\s+/g, '$1|SPLIT|')
    .split('|SPLIT|')
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 500);
}

function generatePosts(text, sourceTitle) {
  const posts = [];
  const seen = new Set();

  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 80 && p.length < 1500);

  const quotes = extractQuotes(text);
  for (const quote of quotes.slice(0, 15)) {
    const key = quote.substring(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);
    posts.push({
      id: 'post-' + posts.length,
      content: quote,
      category: categorizeText(quote),
      type: 'quote',
      source: sourceTitle,
      timestamp: new Date().toISOString()
    });
  }

  for (const para of paragraphs) {
    if (posts.length >= 60) break;
    const key = para.substring(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);

    const sentences = splitIntoSentences(para);
    const best = sentences
      .sort((a, b) => {
        const score = s =>
          (s.match(
            /\b(important|key|significant|essential|crucial|remarkable|notable|interesting|surprising|powerful)\b/gi
          ) || []).length;
        return score(b) - score(a);
      })
      .slice(0, 3);

    if (best.length === 0) continue;
    const content = best.join(' ');
    if (content.length < 40 || content.length > 600) continue;

    posts.push({
      id: 'post-' + posts.length,
      content,
      category: categorizeText(content),
      type: 'insight',
      source: sourceTitle,
      timestamp: new Date().toISOString()
    });
  }

  const listItems =
    text.match(/(?:^|\n)\s*(?:\d+[.)]\s|[-•*]\s)(.{20,300})/g) || [];
  for (const item of listItems.slice(0, 15)) {
    if (posts.length >= 80) break;
    const cleaned = item.replace(/^\s*(?:\d+[.)]\s|[-•*]\s)/, '').trim();
    const key = cleaned.substring(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);
    posts.push({
      id: 'post-' + posts.length,
      content: cleaned,
      category: categorizeText(cleaned),
      type: 'tip',
      source: sourceTitle,
      timestamp: new Date().toISOString()
    });
  }

  for (let i = posts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [posts[i], posts[j]] = [posts[j], posts[i]];
  }

  return posts;
}

// ── Main handler ──
async function handleFile(file) {
  uploadArea.hidden = true;
  processing.hidden = false;
  updateProcessing({
    title: 'Reading your PDF...',
    subtitle: 'Loading file into browser',
    progress: 5
  });

  try {
    const arrayBuffer = await file.arrayBuffer();

    updateProcessing({
      title: 'Parsing pages...',
      subtitle: 'Extracting text content',
      progress: 15
    });

    const { text, numPages } = await extractTextFromPDF(arrayBuffer);

    updateProcessing({
      title: 'Generating posts...',
      subtitle: 'Finding the highlights',
      progress: 75
    });

    const sourceTitle = file.name.replace(/\.pdf$/i, '');
    const posts = generatePosts(text, sourceTitle);

    updateProcessing({
      title: 'Done!',
      subtitle: `Generated ${posts.length} posts from ${numPages} pages`,
      progress: 100
    });

    allPosts = posts;

    setTimeout(() => showFeed(sourceTitle, numPages, posts.length), 800);
  } catch (err) {
    console.error('PDF processing error:', err);
    processingTitle.textContent = 'Oops!';
    processingSubtitle.textContent =
      'Could not read this PDF. Try another file.';
    progressFill.style.width = '0%';
    setTimeout(resetToUpload, 2500);
  }
}

// ── Feed rendering ──
function showFeed(source, pages, postCount) {
  uploadSection.hidden = true;
  filterBar.hidden = false;
  feed.hidden = false;

  const counts = { funny: 0, learning: 0, information: 0 };
  allPosts.forEach(p => counts[p.category]++);

  sourceInfo.innerHTML =
    '<strong>' + escapeHtml(source) + '</strong> &middot; ' +
    pages + ' pages &middot; ' + postCount + ' posts' +
    ' &nbsp;|&nbsp; ' +
    '<span style="color:#ef4444">&#128516; ' + counts.funny + '</span> &middot; ' +
    '<span style="color:#8b5cf6">&#129504; ' + counts.learning + '</span> &middot; ' +
    '<span style="color:#3b82f6">&#128240; ' + counts.information + '</span>';

  renderPosts();
}

function renderPosts() {
  feedGrid.innerHTML = '';

  const filtered =
    currentFilter === 'all'
      ? allPosts
      : allPosts.filter(p => p.category === currentFilter);

  if (filtered.length === 0) {
    emptyState.hidden = false;
    feed.hidden = true;
    return;
  }

  emptyState.hidden = true;
  feed.hidden = false;

  filtered.forEach((post, index) => {
    feedGrid.appendChild(createPostCard(post, index));
  });
}

function createPostCard(post, index) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.dataset.category = post.category;
  card.dataset.type = post.type;
  card.style.animationDelay = Math.min(index * 0.08, 1) + 's';

  const catEmoji = { funny: '&#128516;', learning: '&#129504;', information: '&#128240;' };
  const typeLabel = { quote: '&#128172; Quote', insight: '&#128161; Insight', tip: '&#128204; Tip' };

  card.innerHTML =
    '<div class="post-card-header"><div class="post-gradient-bar"></div></div>' +
    '<div class="post-meta">' +
      '<span class="post-category-badge">' + catEmoji[post.category] + ' ' + post.category + '</span>' +
      '<span class="post-type-badge">' + (typeLabel[post.type] || post.type) + '</span>' +
    '</div>' +
    '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
    '<div class="post-footer">' +
      '<span class="post-source">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>' +
          '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' +
        '</svg> ' +
        escapeHtml(post.source) +
      '</span>' +
      '<div class="post-actions">' +
        '<button class="action-btn like-btn" title="Like" data-id="' + post.id + '">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
          '</svg>' +
        '</button>' +
        '<button class="action-btn bookmark-btn" title="Save" data-id="' + post.id + '">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' +
          '</svg>' +
        '</button>' +
        '<button class="action-btn copy-btn" title="Copy text" data-content="' + encodeURIComponent(post.content) + '">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
            '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
    '</div>';

  // Like
  const likeBtn = card.querySelector('.like-btn');
  if (likedPosts.has(post.id)) {
    likeBtn.classList.add('liked');
    likeBtn.querySelector('svg').setAttribute('fill', 'currentColor');
  }
  likeBtn.addEventListener('click', () => {
    const id = likeBtn.dataset.id;
    if (likedPosts.has(id)) {
      likedPosts.delete(id);
      likeBtn.classList.remove('liked');
      likeBtn.querySelector('svg').setAttribute('fill', 'none');
    } else {
      likedPosts.add(id);
      likeBtn.classList.add('liked');
      likeBtn.querySelector('svg').setAttribute('fill', 'currentColor');
      animateButton(likeBtn);
    }
  });

  // Bookmark
  const bookmarkBtn = card.querySelector('.bookmark-btn');
  if (bookmarkedPosts.has(post.id)) {
    bookmarkBtn.classList.add('bookmarked');
    bookmarkBtn.querySelector('svg').setAttribute('fill', 'currentColor');
  }
  bookmarkBtn.addEventListener('click', () => {
    const id = bookmarkBtn.dataset.id;
    if (bookmarkedPosts.has(id)) {
      bookmarkedPosts.delete(id);
      bookmarkBtn.classList.remove('bookmarked');
      bookmarkBtn.querySelector('svg').setAttribute('fill', 'none');
    } else {
      bookmarkedPosts.add(id);
      bookmarkBtn.classList.add('bookmarked');
      bookmarkBtn.querySelector('svg').setAttribute('fill', 'currentColor');
      animateButton(bookmarkBtn);
    }
  });

  // Copy
  card.querySelector('.copy-btn').addEventListener('click', function () {
    const text = decodeURIComponent(this.dataset.content);
    navigator.clipboard.writeText(text).then(() => {
      this.style.color = '#10b981';
      setTimeout(() => { this.style.color = ''; }, 1000);
    });
  });

  return card;
}

function animateButton(btn) {
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => { btn.style.transform = 'scale(1)'; }, 200);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
