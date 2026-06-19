pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── DOM ──
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInputLibrary = document.getElementById('fileInputLibrary');
const uploadSection = document.getElementById('uploadSection');
const processing = document.getElementById('processing');
const processingTitle = document.getElementById('processingTitle');
const processingSubtitle = document.getElementById('processingSubtitle');
const progressFill = document.getElementById('progressFill');
const libraryBar = document.getElementById('libraryBar');
const libraryBooks = document.getElementById('libraryBooks');
const addBookBtn = document.getElementById('addBookBtn');
const filterBar = document.getElementById('filterBar');
const feed = document.getElementById('feed');
const feedGrid = document.getElementById('feedGrid');
const sourceInfo = document.getElementById('sourceInfo');
const emptyState = document.getElementById('emptyState');
const smartFilterCheckbox = document.getElementById('smartFilter');
const clearDataBtn = document.getElementById('clearDataBtn');
const toast = document.getElementById('toast');

// ── State ──
let library = {};       // { sourceId: { name, pages, posts[], addedAt } }
let preferences = {};   // { likedKeywords:{}, dislikedKeywords:{}, likedCategories:{}, dislikedCategories:{}, likedTypes:{}, dislikedTypes:{}, likedIds:[], dislikedIds:[] }
let currentFilter = 'all';
let activeSource = 'all';
let smartMode = true;

// ── Persistence with localStorage ──
function saveLibrary() {
  try { localStorage.setItem('pg_library', JSON.stringify(library)); } catch(e) {}
}
function loadLibrary() {
  try {
    const d = localStorage.getItem('pg_library');
    if (d) library = JSON.parse(d);
  } catch(e) {}
}
function savePreferences() {
  try { localStorage.setItem('pg_prefs', JSON.stringify(preferences)); } catch(e) {}
}
function loadPreferences() {
  try {
    const d = localStorage.getItem('pg_prefs');
    if (d) preferences = JSON.parse(d);
  } catch(e) {}
  if (!preferences.likedKeywords) preferences.likedKeywords = {};
  if (!preferences.dislikedKeywords) preferences.dislikedKeywords = {};
  if (!preferences.likedCategories) preferences.likedCategories = {};
  if (!preferences.dislikedCategories) preferences.dislikedCategories = {};
  if (!preferences.likedTypes) preferences.likedTypes = {};
  if (!preferences.dislikedTypes) preferences.dislikedTypes = {};
  if (!preferences.likedIds) preferences.likedIds = [];
  if (!preferences.dislikedIds) preferences.dislikedIds = [];
}

// ── Learning model ──
function extractKeywords(text) {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  const stopwords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','each','every','both','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','that','this','these','those','it','its','they','them','their','he','she','his','her','we','our','you','your','i','me','my','what','which','who','whom','whose','about','also','up','one','two','three','many','much','like','get','got','make','made','take','new','know','see','come','think','look','want','give','use','find','tell','ask','work','seem','feel','try','leave','call','said','went','still','well','back','even','us','way','say','go','going']);
  return words.filter(w => w.length > 3 && !stopwords.has(w));
}

function learnFromAction(post, action) {
  const keywords = extractKeywords(post.content);
  const target = action === 'like' ? 'liked' : 'disliked';
  const kw = preferences[target + 'Keywords'];
  const cat = preferences[target + 'Categories'];
  const typ = preferences[target + 'Types'];

  for (const w of keywords) {
    kw[w] = (kw[w] || 0) + 1;
  }
  cat[post.category] = (cat[post.category] || 0) + 1;
  typ[post.type] = (typ[post.type] || 0) + 1;

  if (action === 'like') {
    if (!preferences.likedIds.includes(post.id)) preferences.likedIds.push(post.id);
    preferences.dislikedIds = preferences.dislikedIds.filter(id => id !== post.id);
  } else {
    if (!preferences.dislikedIds.includes(post.id)) preferences.dislikedIds.push(post.id);
    preferences.likedIds = preferences.likedIds.filter(id => id !== post.id);
  }

  savePreferences();
}

function scorePost(post) {
  if (preferences.likedIds.includes(post.id)) return 100;
  if (preferences.dislikedIds.includes(post.id)) return -100;

  let score = 0;
  const keywords = extractKeywords(post.content);

  for (const w of keywords) {
    score += (preferences.likedKeywords[w] || 0) * 2;
    score -= (preferences.dislikedKeywords[w] || 0) * 3;
  }

  score += (preferences.likedCategories[post.category] || 0) * 5;
  score -= (preferences.dislikedCategories[post.category] || 0) * 7;
  score += (preferences.likedTypes[post.type] || 0) * 3;
  score -= (preferences.dislikedTypes[post.type] || 0) * 4;

  return score;
}

function shouldHidePost(post) {
  if (preferences.dislikedIds.includes(post.id)) return true;
  return scorePost(post) < -15;
}

// ── Card colors ──
const CARD_PALETTES = {
  funny: [
    { bg: 'linear-gradient(135deg, #fff5f5, #ffe4e6)', border: '#fecdd3' },
    { bg: 'linear-gradient(135deg, #fff7ed, #ffedd5)', border: '#fed7aa' },
    { bg: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', border: '#fbcfe8' },
  ],
  learning: [
    { bg: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', border: '#c7d2fe' },
    { bg: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', border: '#ddd6fe' },
    { bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '#a7f3d0' },
  ],
  information: [
    { bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '#bfdbfe' },
    { bg: 'linear-gradient(135deg, #ecfeff, #cffafe)', border: '#a5f3fc' },
    { bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '#bbf7d0' },
  ]
};

function getCardPalette(post, index) {
  const palettes = CARD_PALETTES[post.category] || CARD_PALETTES.information;
  return palettes[index % palettes.length];
}

// ── Upload interactions ──
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') handleFile(f);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
fileInputLibrary.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
addBookBtn.addEventListener('click', () => fileInputLibrary.click());

smartFilterCheckbox.addEventListener('change', () => {
  smartMode = smartFilterCheckbox.checked;
  renderPosts();
});

clearDataBtn.addEventListener('click', () => {
  if (confirm('Reset all learned preferences? Your uploaded PDFs will stay.')) {
    preferences = {
      likedKeywords:{}, dislikedKeywords:{},
      likedCategories:{}, dislikedCategories:{},
      likedTypes:{}, dislikedTypes:{},
      likedIds:[], dislikedIds:[]
    };
    savePreferences();
    showToast('Preferences reset');
    renderPosts();
  }
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderPosts();
  });
});

// ── Processing UI ──
function updateProcessing({ title, subtitle, progress }) {
  processingTitle.textContent = title;
  processingSubtitle.textContent = subtitle;
  progressFill.style.width = progress + '%';
}

// ── PDF extraction ──
async function extractTextFromPDF(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  let fullText = '';
  for (let i = 1; i <= totalPages; i++) {
    if (i % 10 === 0 || i === 1) {
      updateProcessing({
        title: 'Reading page ' + i + ' of ' + totalPages + '...',
        subtitle: Math.round((i / totalPages) * 100) + '% done',
        progress: Math.round((i / totalPages) * 60)
      });
    }
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(item => item.str).join(' ') + '\n\n';
  }
  return { text: fullText, numPages: totalPages };
}

// ── Content processing ──
const CATEGORY_KEYWORDS = {
  funny: ['joke','humor','laugh','funny','comedy','hilarious','wit','sarcasm','irony','pun','satire','absurd','ridiculous','amusing','comical','giggle','chuckle','fool','silly','nonsense','parody','mock','haha','lol','rofl'],
  learning: ['learn','study','research','theory','principle','concept','method','technique','strategy','framework','approach','lesson','education','knowledge','understand','discover','experiment','hypothesis','analysis','insight','skill','practice','master','develop','improve','growth','teach','science','mathematical','formula','equation','theorem','chapter','exercise','definition','rule','step'],
  information: ['report','data','statistic','fact','news','update','announce','according','survey','percent','million','billion','government','policy','economy','market','industry','company','organization','country','world','global','national','international','official','source','history','event','date','year','century','population']
};

function categorizeText(text) {
  const lower = text.toLowerCase();
  const scores = { funny: 0, learning: 0, information: 0 };
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of kws) {
      const m = lower.match(new RegExp('\\b' + kw + '\\b', 'gi'));
      if (m) scores[cat] += m.length;
    }
  }
  const max = Math.max(...Object.values(scores));
  if (max === 0) return 'information';
  return Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a, ['information', 0])[0];
}

function extractQuotes(text) {
  const quotes = [];
  for (const p of [/["“„”]([^"“”„]{20,200})["“”„]/g]) {
    let m; while ((m = p.exec(text)) !== null) quotes.push(m[1].trim());
  }
  return quotes;
}

function splitIntoSentences(text) {
  return text.replace(/([.!?])\s+/g, '$1|SPLIT|').split('|SPLIT|')
    .map(s => s.trim()).filter(s => s.length > 20 && s.length < 500);
}

function generatePosts(text, sourceTitle, sourceId) {
  const posts = []; const seen = new Set();
  const paragraphs = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 80 && p.length < 1500);

  for (const q of extractQuotes(text).slice(0, 15)) {
    const k = q.substring(0, 50); if (seen.has(k)) continue; seen.add(k);
    posts.push({ id: sourceId + '-' + posts.length, content: q, category: categorizeText(q), type: 'quote', source: sourceTitle, sourceId });
  }

  for (const para of paragraphs) {
    if (posts.length >= 60) break;
    const k = para.substring(0, 50); if (seen.has(k)) continue; seen.add(k);
    const best = splitIntoSentences(para).sort((a, b) => {
      const sc = s => (s.match(/\b(important|key|significant|essential|crucial|remarkable|notable|interesting|surprising|powerful)\b/gi) || []).length;
      return sc(b) - sc(a);
    }).slice(0, 3);
    if (!best.length) continue;
    const content = best.join(' ');
    if (content.length < 40 || content.length > 600) continue;
    posts.push({ id: sourceId + '-' + posts.length, content, category: categorizeText(content), type: 'insight', source: sourceTitle, sourceId });
  }

  const listItems = text.match(/(?:^|\n)\s*(?:\d+[.)]\s|[-•*]\s)(.{20,300})/g) || [];
  for (const item of listItems.slice(0, 15)) {
    if (posts.length >= 80) break;
    const cleaned = item.replace(/^\s*(?:\d+[.)]\s|[-•*]\s)/, '').trim();
    const k = cleaned.substring(0, 50); if (seen.has(k)) continue; seen.add(k);
    posts.push({ id: sourceId + '-' + posts.length, content: cleaned, category: categorizeText(cleaned), type: 'tip', source: sourceTitle, sourceId });
  }

  for (let i = posts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [posts[i], posts[j]] = [posts[j], posts[i]];
  }
  return posts;
}

// ── File handler ──
async function handleFile(file) {
  uploadSection.hidden = false;
  uploadArea.hidden = true;
  processing.hidden = false;
  updateProcessing({ title: 'Reading your PDF...', subtitle: 'Loading file', progress: 5 });

  try {
    const arrayBuffer = await file.arrayBuffer();
    updateProcessing({ title: 'Parsing pages...', subtitle: 'Extracting text', progress: 15 });
    const { text, numPages } = await extractTextFromPDF(arrayBuffer);
    updateProcessing({ title: 'Generating posts...', subtitle: 'Finding highlights', progress: 75 });

    const sourceTitle = file.name.replace(/\.pdf$/i, '');
    const sourceId = 'src-' + Date.now();
    const posts = generatePosts(text, sourceTitle, sourceId);

    library[sourceId] = { name: sourceTitle, pages: numPages, posts, addedAt: Date.now() };
    saveLibrary();

    updateProcessing({ title: 'Done!', subtitle: 'Generated ' + posts.length + ' posts from ' + numPages + ' pages', progress: 100 });

    setTimeout(() => {
      activeSource = sourceId;
      showFeedView();
    }, 800);
  } catch (err) {
    console.error('PDF processing error:', err);
    processingTitle.textContent = 'Oops!';
    processingSubtitle.textContent = 'Could not read this PDF. Try another file.';
    progressFill.style.width = '0%';
    setTimeout(() => { processing.hidden = true; uploadArea.hidden = false; }, 2500);
  }
}

// ── Library rendering ──
function renderLibrary() {
  libraryBooks.innerHTML = '';
  const sources = Object.entries(library).sort((a, b) => b[1].addedAt - a[1].addedAt);
  if (sources.length === 0) { libraryBar.hidden = true; return; }

  libraryBar.hidden = false;

  // "All" pill
  const allPill = document.createElement('button');
  allPill.className = 'book-pill book-pill-all' + (activeSource === 'all' ? ' active' : '');
  const totalPosts = sources.reduce((sum, [, s]) => sum + s.posts.length, 0);
  allPill.innerHTML = 'All <span class="book-count">(' + totalPosts + ')</span>';
  allPill.addEventListener('click', () => { activeSource = 'all'; showFeedView(); });
  libraryBooks.appendChild(allPill);

  for (const [id, src] of sources) {
    const pill = document.createElement('button');
    pill.className = 'book-pill' + (activeSource === id ? ' active' : '');
    pill.innerHTML = escapeHtml(src.name) + ' <span class="book-count">(' + src.posts.length + ')</span>' +
      '<span class="book-remove" data-id="' + id + '">&times;</span>';
    pill.addEventListener('click', (e) => {
      if (e.target.classList.contains('book-remove')) return;
      activeSource = id; showFeedView();
    });
    pill.querySelector('.book-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Remove "' + src.name + '" from library?')) {
        delete library[id]; saveLibrary();
        if (activeSource === id) activeSource = 'all';
        if (Object.keys(library).length === 0) { resetToUpload(); return; }
        showFeedView();
      }
    });
    libraryBooks.appendChild(pill);
  }
}

// ── Get all posts (across sources or for one) ──
function getAllPosts() {
  if (activeSource === 'all') {
    return Object.values(library).flatMap(s => s.posts);
  }
  return library[activeSource] ? library[activeSource].posts : [];
}

// ── Show feed view ──
function showFeedView() {
  uploadSection.hidden = true;
  filterBar.hidden = false;
  feed.hidden = false;
  renderLibrary();
  updateSourceInfo();
  renderPosts();
}

function updateSourceInfo() {
  const posts = getAllPosts();
  const counts = { funny: 0, learning: 0, information: 0 };
  posts.forEach(p => counts[p.category]++);
  const liked = preferences.likedIds.filter(id => posts.some(p => p.id === id)).length;

  const srcName = activeSource === 'all' ? 'All Books' :
    (library[activeSource] ? library[activeSource].name : '');
  const pages = activeSource === 'all' ?
    Object.values(library).reduce((s, src) => s + src.pages, 0) :
    (library[activeSource] ? library[activeSource].pages : 0);

  sourceInfo.innerHTML =
    '<strong>' + escapeHtml(srcName) + '</strong> &middot; ' + pages + ' pages &middot; ' + posts.length + ' posts' +
    ' &nbsp;|&nbsp; ' +
    '<span style="color:#ef4444">&#128516; ' + counts.funny + '</span> &middot; ' +
    '<span style="color:#8b5cf6">&#129504; ' + counts.learning + '</span> &middot; ' +
    '<span style="color:#3b82f6">&#128240; ' + counts.information + '</span>' +
    (liked > 0 ? ' &middot; <span style="color:#22c55e">&#10084;&#65039; ' + liked + '</span>' : '');
}

function resetToUpload() {
  currentFilter = 'all'; activeSource = 'all';
  fileInput.value = '';
  uploadSection.hidden = false; uploadArea.hidden = false;
  processing.hidden = true; filterBar.hidden = true;
  feed.hidden = true; emptyState.hidden = true; libraryBar.hidden = true;
  feedGrid.innerHTML = '';
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-filter="all"]').classList.add('active');
}

// ── Render posts ──
function renderPosts() {
  feedGrid.innerHTML = '';
  let posts = getAllPosts();

  // Filter by category
  if (currentFilter === 'liked') {
    posts = posts.filter(p => preferences.likedIds.includes(p.id));
  } else if (currentFilter !== 'all') {
    posts = posts.filter(p => p.category === currentFilter);
  }

  // Smart mode: hide disliked patterns
  if (smartMode && currentFilter !== 'liked') {
    posts = posts.filter(p => !shouldHidePost(p));
  }

  // Sort: liked first, then by score descending
  posts.sort((a, b) => {
    const aLiked = preferences.likedIds.includes(a.id) ? 1 : 0;
    const bLiked = preferences.likedIds.includes(b.id) ? 1 : 0;
    if (aLiked !== bLiked) return bLiked - aLiked;
    return scorePost(b) - scorePost(a);
  });

  if (posts.length === 0) {
    emptyState.hidden = false; feed.hidden = true; return;
  }
  emptyState.hidden = true; feed.hidden = false;

  posts.forEach((post, index) => {
    feedGrid.appendChild(createPostCard(post, index));
  });
}

// ── Create card ──
function createPostCard(post, index) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.dataset.category = post.category;
  card.dataset.type = post.type;
  card.dataset.id = post.id;
  card.style.animationDelay = Math.min(index * 0.06, 0.8) + 's';

  const palette = getCardPalette(post, index);
  card.style.background = palette.bg;
  card.style.borderLeft = '4px solid ' + palette.border;

  const isLiked = preferences.likedIds.includes(post.id);
  const isDisliked = preferences.dislikedIds.includes(post.id);
  const score = scorePost(post);

  const catEmoji = { funny: '&#128516;', learning: '&#129504;', information: '&#128240;' };
  const typeLabel = { quote: '&#128172; Quote', insight: '&#128161; Insight', tip: '&#128204; Tip' };

  card.innerHTML =
    '<div class="post-card-header"><div class="post-gradient-bar"></div></div>' +
    (score > 10 ? '<div class="score-badge high">&#9733; For you</div>' : '') +
    '<div class="post-meta">' +
      '<span class="post-category-badge">' + (catEmoji[post.category] || '') + ' ' + post.category + '</span>' +
      '<span class="post-type-badge">' + (typeLabel[post.type] || post.type) + '</span>' +
    '</div>' +
    '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
    '<div class="post-footer">' +
      '<span class="post-source">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>' +
          '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>' +
        '</svg> ' + escapeHtml(post.source) +
      '</span>' +
      '<div class="post-actions">' +
        '<button class="action-btn like-action' + (isLiked ? ' liked' : '') + '" title="Like - show more like this">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + (isLiked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2">' +
            '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>' +
            '<path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>' +
          '</svg>' +
        '</button>' +
        '<button class="action-btn dislike-action' + (isDisliked ? ' disliked' : '') + '" title="Dislike - show less like this">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="' + (isDisliked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2">' +
            '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>' +
            '<path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>' +
          '</svg>' +
        '</button>' +
        '<button class="action-btn copy-action" title="Copy text">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
            '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
          '</svg>' +
        '</button>' +
      '</div>' +
    '</div>';

  // Like
  card.querySelector('.like-action').addEventListener('click', function() {
    if (preferences.likedIds.includes(post.id)) {
      preferences.likedIds = preferences.likedIds.filter(id => id !== post.id);
      this.classList.remove('liked');
      this.querySelector('svg').setAttribute('fill', 'none');
      showToast('Removed from liked');
    } else {
      learnFromAction(post, 'like');
      this.classList.add('liked');
      this.querySelector('svg').setAttribute('fill', 'currentColor');
      const disBtn = card.querySelector('.dislike-action');
      disBtn.classList.remove('disliked');
      disBtn.querySelector('svg').setAttribute('fill', 'none');
      animateButton(this);
      showToast('Liked! Will show more like this');
    }
    savePreferences(); updateSourceInfo();
  });

  // Dislike
  card.querySelector('.dislike-action').addEventListener('click', function() {
    learnFromAction(post, 'dislike');
    card.classList.add('removing');
    showToast('Got it! Showing less like this');
    setTimeout(() => {
      card.remove();
      updateSourceInfo();
    }, 400);
  });

  // Copy
  card.querySelector('.copy-action').addEventListener('click', function() {
    navigator.clipboard.writeText(post.content).then(() => {
      this.style.color = '#22c55e';
      setTimeout(() => { this.style.color = ''; }, 1000);
    });
  });

  return card;
}

// ── Toast ──
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2000);
}

function animateButton(btn) {
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => { btn.style.transform = 'scale(1)'; }, 200);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Init ──
loadLibrary();
loadPreferences();

if (Object.keys(library).length > 0) {
  activeSource = 'all';
  showFeedView();
} else {
  resetToUpload();
}
