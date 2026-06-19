if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ══════════════════════════════════════
//  USER SYSTEM
// ══════════════════════════════════════

const AVATAR_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#06b6d4',
  '#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899',
];

function getAvatarColor(username) {
  var hash = 0;
  for (var i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(username) {
  return username.substring(0, 2).toUpperCase();
}

function getAllUsers() {
  try { return JSON.parse(localStorage.getItem('pg_users') || '{}'); } catch(e) { return {}; }
}

function saveAllUsers(users) {
  try { localStorage.setItem('pg_users', JSON.stringify(users)); } catch(e) {}
}

function getCurrentUser() {
  try { return localStorage.getItem('pg_current_user'); } catch(e) { return null; }
}

function setCurrentUser(username) {
  try { localStorage.setItem('pg_current_user', username); } catch(e) {}
}

function clearCurrentUser() {
  try { localStorage.removeItem('pg_current_user'); } catch(e) {}
}

function createUser(username) {
  var users = getAllUsers();
  users[username] = { createdAt: Date.now(), lastLogin: Date.now() };
  saveAllUsers(users);
  try {
    localStorage.setItem('pg_lib_' + username, JSON.stringify({}));
    localStorage.setItem('pg_prefs_' + username, JSON.stringify({
      likedKeywords:{}, dislikedKeywords:{},
      likedCategories:{}, dislikedCategories:{},
      likedTypes:{}, dislikedTypes:{},
      likedIds:[], dislikedIds:[]
    }));
  } catch(e) {}
}

function deleteUser(username) {
  var users = getAllUsers();
  delete users[username];
  saveAllUsers(users);
  try {
    localStorage.removeItem('pg_lib_' + username);
    localStorage.removeItem('pg_prefs_' + username);
  } catch(e) {}
}

function userExists(username) {
  return username in getAllUsers();
}

function getUserLibrary(username) {
  try { return JSON.parse(localStorage.getItem('pg_lib_' + username) || '{}'); } catch(e) { return {}; }
}

// ══════════════════════════════════════
//  LOGIN SCREEN
// ══════════════════════════════════════

var loginScreen = document.getElementById('loginScreen');
var mainApp = document.getElementById('mainApp');
var usernameInput = document.getElementById('usernameInput');
var usernameHint = document.getElementById('usernameHint');
var loginBtn = document.getElementById('loginBtn');
var loginBtnText = document.getElementById('loginBtnText');
var existingUsersSection = document.getElementById('existingUsers');
var userPillsContainer = document.getElementById('userPills');

function isValidUsername(u) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(u);
}

usernameInput.addEventListener('input', function() {
  var val = usernameInput.value.trim();
  usernameHint.classList.remove('error', 'success');

  if (val.length === 0) {
    usernameHint.textContent = 'Letters, numbers & underscores. 3-20 chars.';
    loginBtn.disabled = true;
    return;
  }

  if (!isValidUsername(val)) {
    usernameHint.textContent = 'Only letters, numbers & underscores. Min 3 chars.';
    usernameHint.classList.add('error');
    loginBtn.disabled = true;
    return;
  }

  if (userExists(val)) {
    usernameHint.textContent = 'Welcome back, ' + val + '!';
    usernameHint.classList.add('success');
    loginBtnText.textContent = 'Continue';
  } else {
    usernameHint.textContent = 'New account will be created';
    usernameHint.classList.add('success');
    loginBtnText.textContent = 'Get Started';
  }
  loginBtn.disabled = false;
});

usernameInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !loginBtn.disabled) doLogin();
});

loginBtn.addEventListener('click', doLogin);

function doLogin() {
  try {
    var username = usernameInput.value.trim();
    if (!isValidUsername(username)) return;

    if (!userExists(username)) {
      createUser(username);
    } else {
      var users = getAllUsers();
      users[username].lastLogin = Date.now();
      saveAllUsers(users);
    }

    setCurrentUser(username);
    enterApp(username);
  } catch(err) {
    console.error('Login error:', err);
    alert('Something went wrong: ' + err.message);
  }
}

function renderExistingUsers() {
  var users = getAllUsers();
  var names = Object.keys(users).sort(function(a, b) {
    return (users[b].lastLogin || 0) - (users[a].lastLogin || 0);
  });

  if (names.length === 0) {
    existingUsersSection.hidden = true;
    return;
  }

  existingUsersSection.hidden = false;
  userPillsContainer.innerHTML = '';

  names.forEach(function(name) {
    var pill = document.createElement('button');
    pill.className = 'user-pill';
    var color = getAvatarColor(name);
    var lib = getUserLibrary(name);
    var postCount = Object.values(lib).reduce(function(s, src) { return s + src.posts.length; }, 0);

    pill.innerHTML =
      '<span class="pill-avatar" style="background:' + color + '">' + getInitials(name) + '</span>' +
      '<span>' + escapeHtml(name) + '</span>' +
      (postCount > 0 ? '<span class="pill-stats">' + postCount + ' posts</span>' : '') +
      '<span class="pill-remove" title="Delete account">&times;</span>';

    pill.addEventListener('click', function(e) {
      if (e.target.classList.contains('pill-remove')) return;
      var allUsers = getAllUsers();
      allUsers[name].lastLogin = Date.now();
      saveAllUsers(allUsers);
      setCurrentUser(name);
      enterApp(name);
    });

    pill.querySelector('.pill-remove').addEventListener('click', function(e) {
      e.stopPropagation();
      if (confirm('Delete user "' + name + '" and all their data?')) {
        deleteUser(name);
        if (getCurrentUser() === name) clearCurrentUser();
        renderExistingUsers();
      }
    });

    userPillsContainer.appendChild(pill);
  });
}

function showLogin() {
  loginScreen.style.display = 'flex';
  mainApp.style.display = 'none';
  usernameInput.value = '';
  usernameHint.textContent = 'Letters, numbers & underscores. 3-20 chars.';
  usernameHint.classList.remove('error', 'success');
  loginBtn.disabled = true;
  loginBtnText.textContent = 'Get Started';
  renderExistingUsers();
  setTimeout(function() { usernameInput.focus(); }, 100);
}

// ══════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════

var currentUser = null;
var library = {};
var preferences = {};
var currentFilter = 'all';
var activeSource = 'all';
var smartMode = true;

function enterApp(username) {
  currentUser = username;

  loginScreen.style.display = 'none';
  mainApp.style.display = 'block';

  var avatar = document.getElementById('userAvatar');
  var uname = document.getElementById('userName');
  avatar.textContent = getInitials(username);
  avatar.style.background = getAvatarColor(username);
  uname.textContent = username;

  loadUserData();

  var welcomeMsg = document.getElementById('welcomeMsg');
  var bookCount = Object.keys(library).length;
  if (bookCount > 0) {
    welcomeMsg.innerHTML = '<h2>Hey, ' + escapeHtml(username) + '!</h2><p>' + bookCount + ' book' + (bookCount > 1 ? 's' : '') + ' in your library</p>';
  } else {
    welcomeMsg.innerHTML = '<h2>Welcome, ' + escapeHtml(username) + '!</h2><p>Upload your first PDF to get started</p>';
  }

  if (Object.keys(library).length > 0) {
    activeSource = 'all';
    showFeedView();
  } else {
    resetToUpload();
  }
}

// ── DOM refs ──
var uploadArea = document.getElementById('uploadArea');
var fileInput = document.getElementById('fileInput');
var fileInputLibrary = document.getElementById('fileInputLibrary');
var uploadSection = document.getElementById('uploadSection');
var processing = document.getElementById('processing');
var processingTitle = document.getElementById('processingTitle');
var processingSubtitle = document.getElementById('processingSubtitle');
var progressFill = document.getElementById('progressFill');
var libraryBar = document.getElementById('libraryBar');
var libraryBooks = document.getElementById('libraryBooks');
var addBookBtn = document.getElementById('addBookBtn');
var filterBar = document.getElementById('filterBar');
var feed = document.getElementById('feed');
var feedGrid = document.getElementById('feedGrid');
var sourceInfo = document.getElementById('sourceInfo');
var emptyState = document.getElementById('emptyState');
var smartFilterCheckbox = document.getElementById('smartFilter');
var clearDataBtn = document.getElementById('clearDataBtn');
var toast = document.getElementById('toast');

// ── Persistence (per user) ──
function saveLibrary() {
  if (!currentUser) return;
  try { localStorage.setItem('pg_lib_' + currentUser, JSON.stringify(library)); } catch(e) {
    console.error('Failed to save library:', e);
  }
}

function loadUserData() {
  if (!currentUser) return;
  try { library = JSON.parse(localStorage.getItem('pg_lib_' + currentUser) || '{}'); } catch(e) { library = {}; }
  try { preferences = JSON.parse(localStorage.getItem('pg_prefs_' + currentUser) || '{}'); } catch(e) { preferences = {}; }
  if (!preferences.likedKeywords) preferences.likedKeywords = {};
  if (!preferences.dislikedKeywords) preferences.dislikedKeywords = {};
  if (!preferences.likedCategories) preferences.likedCategories = {};
  if (!preferences.dislikedCategories) preferences.dislikedCategories = {};
  if (!preferences.likedTypes) preferences.likedTypes = {};
  if (!preferences.dislikedTypes) preferences.dislikedTypes = {};
  if (!preferences.likedIds) preferences.likedIds = [];
  if (!preferences.dislikedIds) preferences.dislikedIds = [];
}

function savePreferences() {
  if (!currentUser) return;
  try { localStorage.setItem('pg_prefs_' + currentUser, JSON.stringify(preferences)); } catch(e) {}
}

// ── Learning model ──
function extractKeywords(text) {
  var words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  var stop = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','each','every','both','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','that','this','these','those','it','its','they','them','their','he','she','his','her','we','our','you','your','i','me','my','what','which','who','whom','whose','about','also','up','one','two','three','many','much','like','get','got','make','made','take','new','know','see','come','think','look','want','give','use','find','tell','ask','work','seem','feel','try','leave','call','said','went','still','well','back','even','us','way','say','go','going']);
  return words.filter(function(w) { return w.length > 3 && !stop.has(w); });
}

function learnFromAction(post, action) {
  var keywords = extractKeywords(post.content);
  var target = action === 'like' ? 'liked' : 'disliked';
  var kw = preferences[target + 'Keywords'];
  var cat = preferences[target + 'Categories'];
  var typ = preferences[target + 'Types'];
  keywords.forEach(function(w) { kw[w] = (kw[w] || 0) + 1; });
  cat[post.category] = (cat[post.category] || 0) + 1;
  typ[post.type] = (typ[post.type] || 0) + 1;
  if (action === 'like') {
    if (preferences.likedIds.indexOf(post.id) === -1) preferences.likedIds.push(post.id);
    preferences.dislikedIds = preferences.dislikedIds.filter(function(id) { return id !== post.id; });
  } else {
    if (preferences.dislikedIds.indexOf(post.id) === -1) preferences.dislikedIds.push(post.id);
    preferences.likedIds = preferences.likedIds.filter(function(id) { return id !== post.id; });
  }
  savePreferences();
}

function scorePost(post) {
  if (preferences.likedIds.indexOf(post.id) !== -1) return 100;
  if (preferences.dislikedIds.indexOf(post.id) !== -1) return -100;
  var score = 0;
  extractKeywords(post.content).forEach(function(w) {
    score += (preferences.likedKeywords[w] || 0) * 2;
    score -= (preferences.dislikedKeywords[w] || 0) * 3;
  });
  score += (preferences.likedCategories[post.category] || 0) * 5;
  score -= (preferences.dislikedCategories[post.category] || 0) * 7;
  score += (preferences.likedTypes[post.type] || 0) * 3;
  score -= (preferences.dislikedTypes[post.type] || 0) * 4;
  return score;
}

function shouldHidePost(post) {
  if (preferences.dislikedIds.indexOf(post.id) !== -1) return true;
  return scorePost(post) < -15;
}

// ── Card colors ──
var CARD_PALETTES = {
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

function getCardPalette(post, i) {
  return (CARD_PALETTES[post.category] || CARD_PALETTES.information)[i % 3];
}

// ── Upload interactions ──
uploadArea.addEventListener('click', function() { fileInput.click(); });
uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('drag-over'); });
uploadArea.addEventListener('drop', function(e) {
  e.preventDefault(); uploadArea.classList.remove('drag-over');
  var f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') handleFile(f);
});

fileInput.addEventListener('change', function(e) {
  if (e.target.files[0]) handleFile(e.target.files[0]);
  e.target.value = '';
});

fileInputLibrary.addEventListener('change', function(e) {
  if (e.target.files[0]) handleFile(e.target.files[0]);
  e.target.value = '';
});

addBookBtn.addEventListener('click', function() { fileInputLibrary.click(); });

document.getElementById('logoutBtn').addEventListener('click', function() {
  clearCurrentUser();
  currentUser = null;
  library = {};
  preferences = {};
  showLogin();
});

smartFilterCheckbox.addEventListener('change', function() { smartMode = smartFilterCheckbox.checked; renderPosts(); });

clearDataBtn.addEventListener('click', function() {
  if (confirm('Reset all learned preferences for ' + currentUser + '? Your PDFs stay.')) {
    preferences = { likedKeywords:{}, dislikedKeywords:{}, likedCategories:{}, dislikedCategories:{}, likedTypes:{}, dislikedTypes:{}, likedIds:[], dislikedIds:[] };
    savePreferences();
    showToast('Preferences reset');
    renderPosts();
  }
});

document.querySelectorAll('.chip').forEach(function(chip) {
  chip.addEventListener('click', function() {
    document.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderPosts();
  });
});

// ── Processing ──
function updateProcessing(opts) {
  processingTitle.textContent = opts.title;
  processingSubtitle.textContent = opts.subtitle;
  progressFill.style.width = opts.progress + '%';
}

// ── PDF extraction ──
function extractTextFromPDF(arrayBuffer) {
  if (typeof pdfjsLib === 'undefined') {
    return Promise.reject(new Error('PDF library not loaded. Please refresh the page.'));
  }
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise.then(function(pdf) {
    var totalPages = pdf.numPages;
    var fullText = '';
    var chain = Promise.resolve();
    for (var i = 1; i <= totalPages; i++) {
      (function(pageNum) {
        chain = chain.then(function() {
          if (pageNum % 10 === 0 || pageNum === 1) {
            updateProcessing({
              title: 'Reading page ' + pageNum + ' of ' + totalPages + '...',
              subtitle: Math.round((pageNum / totalPages) * 100) + '% done',
              progress: Math.round((pageNum / totalPages) * 60)
            });
          }
          return pdf.getPage(pageNum).then(function(page) {
            return page.getTextContent().then(function(content) {
              fullText += content.items.map(function(item) { return item.str; }).join(' ') + '\n\n';
            });
          });
        });
      })(i);
    }
    return chain.then(function() { return { text: fullText, numPages: totalPages }; });
  });
}

// ── Content processing ──
var CATEGORY_KEYWORDS = {
  funny: ['joke','humor','laugh','funny','comedy','hilarious','wit','sarcasm','irony','pun','satire','absurd','ridiculous','amusing','comical','giggle','chuckle','fool','silly','nonsense','parody','mock','haha','lol','rofl'],
  learning: ['learn','study','research','theory','principle','concept','method','technique','strategy','framework','approach','lesson','education','knowledge','understand','discover','experiment','hypothesis','analysis','insight','skill','practice','master','develop','improve','growth','teach','science','mathematical','formula','equation','theorem','chapter','exercise','definition','rule','step'],
  information: ['report','data','statistic','fact','news','update','announce','according','survey','percent','million','billion','government','policy','economy','market','industry','company','organization','country','world','global','national','international','official','source','history','event','date','year','century','population']
};

function categorizeText(text) {
  var lower = text.toLowerCase();
  var scores = { funny: 0, learning: 0, information: 0 };
  Object.keys(CATEGORY_KEYWORDS).forEach(function(cat) {
    CATEGORY_KEYWORDS[cat].forEach(function(kw) {
      var m = lower.match(new RegExp('\\b' + kw + '\\b', 'gi'));
      if (m) scores[cat] += m.length;
    });
  });
  var max = Math.max(scores.funny, scores.learning, scores.information);
  if (max === 0) return 'information';
  if (scores.funny >= scores.learning && scores.funny >= scores.information) return 'funny';
  if (scores.learning >= scores.information) return 'learning';
  return 'information';
}

function extractQuotes(text) {
  var quotes = [];
  var regex = /["“„‟]([^"”“„]{20,200})["”„‟]/g;
  var m;
  while ((m = regex.exec(text)) !== null) quotes.push(m[1].trim());
  return quotes;
}

function splitIntoSentences(text) {
  return text.replace(/([.!?])\s+/g, '$1|SPLIT|').split('|SPLIT|')
    .map(function(s) { return s.trim(); })
    .filter(function(s) { return s.length > 20 && s.length < 500; });
}

function generatePosts(text, sourceTitle, sourceId) {
  var posts = [];
  var seen = new Set();
  var paragraphs = text.split(/\n\s*\n/)
    .map(function(p) { return p.replace(/\s+/g, ' ').trim(); })
    .filter(function(p) { return p.length > 80 && p.length < 1500; });

  extractQuotes(text).slice(0, 15).forEach(function(q) {
    var k = q.substring(0, 50);
    if (seen.has(k)) return;
    seen.add(k);
    posts.push({ id: sourceId + '-' + posts.length, content: q, category: categorizeText(q), type: 'quote', source: sourceTitle, sourceId: sourceId });
  });

  paragraphs.forEach(function(para) {
    if (posts.length >= 60) return;
    var k = para.substring(0, 50);
    if (seen.has(k)) return;
    seen.add(k);
    var best = splitIntoSentences(para).sort(function(a, b) {
      var sc = function(s) { return (s.match(/\b(important|key|significant|essential|crucial|remarkable|notable|interesting|surprising|powerful)\b/gi) || []).length; };
      return sc(b) - sc(a);
    }).slice(0, 3);
    if (!best.length) return;
    var content = best.join(' ');
    if (content.length < 40 || content.length > 600) return;
    posts.push({ id: sourceId + '-' + posts.length, content: content, category: categorizeText(content), type: 'insight', source: sourceTitle, sourceId: sourceId });
  });

  var listItems = text.match(/(?:^|\n)\s*(?:\d+[.)]\s|[-•*]\s)(.{20,300})/g) || [];
  listItems.slice(0, 15).forEach(function(item) {
    if (posts.length >= 80) return;
    var cleaned = item.replace(/^\s*(?:\d+[.)]\s|[-•*]\s)/, '').trim();
    var k = cleaned.substring(0, 50);
    if (seen.has(k)) return;
    seen.add(k);
    posts.push({ id: sourceId + '-' + posts.length, content: cleaned, category: categorizeText(cleaned), type: 'tip', source: sourceTitle, sourceId: sourceId });
  });

  for (var i = posts.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = posts[i]; posts[i] = posts[j]; posts[j] = temp;
  }
  return posts;
}

// ── File handler ──
function handleFile(file) {
  uploadSection.hidden = false;
  uploadArea.hidden = true;
  processing.hidden = false;
  document.getElementById('welcomeMsg').hidden = true;
  updateProcessing({ title: 'Reading your PDF...', subtitle: 'Loading file', progress: 5 });

  file.arrayBuffer().then(function(arrayBuffer) {
    updateProcessing({ title: 'Parsing pages...', subtitle: 'Extracting text', progress: 15 });
    return extractTextFromPDF(arrayBuffer);
  }).then(function(result) {
    updateProcessing({ title: 'Generating posts...', subtitle: 'Finding highlights', progress: 75 });

    var sourceTitle = file.name.replace(/\.pdf$/i, '');
    var sourceId = 'src-' + Date.now();
    var posts = generatePosts(result.text, sourceTitle, sourceId);

    library[sourceId] = { name: sourceTitle, pages: result.numPages, posts: posts, addedAt: Date.now() };
    saveLibrary();

    updateProcessing({ title: 'Done!', subtitle: posts.length + ' posts from ' + result.numPages + ' pages', progress: 100 });

    setTimeout(function() {
      activeSource = 'all';
      showFeedView();
    }, 800);
  }).catch(function(err) {
    console.error('PDF processing error:', err);
    processingTitle.textContent = 'Oops!';
    processingSubtitle.textContent = err.message || 'Could not read this PDF. Try another file.';
    progressFill.style.width = '0%';
    setTimeout(function() {
      processing.hidden = true;
      uploadArea.hidden = false;
      document.getElementById('welcomeMsg').hidden = false;
    }, 2500);
  });
}

// ── Library ──
function renderLibrary() {
  libraryBooks.innerHTML = '';
  var sources = Object.entries(library).sort(function(a, b) { return b[1].addedAt - a[1].addedAt; });
  if (sources.length === 0) { libraryBar.hidden = true; return; }
  libraryBar.hidden = false;

  var allPill = document.createElement('button');
  allPill.className = 'book-pill book-pill-all' + (activeSource === 'all' ? ' active' : '');
  var total = sources.reduce(function(s, entry) { return s + entry[1].posts.length; }, 0);
  allPill.innerHTML = 'All <span class="book-count">(' + total + ')</span>';
  allPill.addEventListener('click', function() { activeSource = 'all'; showFeedView(); });
  libraryBooks.appendChild(allPill);

  sources.forEach(function(entry) {
    var id = entry[0], src = entry[1];
    var pill = document.createElement('button');
    pill.className = 'book-pill' + (activeSource === id ? ' active' : '');
    pill.innerHTML = escapeHtml(src.name) + ' <span class="book-count">(' + src.posts.length + ')</span><span class="book-remove" data-id="' + id + '">&times;</span>';
    pill.addEventListener('click', function(e) {
      if (e.target.classList.contains('book-remove')) return;
      activeSource = id;
      showFeedView();
    });
    pill.querySelector('.book-remove').addEventListener('click', function(e) {
      e.stopPropagation();
      if (confirm('Remove "' + src.name + '"?')) {
        delete library[id];
        saveLibrary();
        if (activeSource === id) activeSource = 'all';
        if (!Object.keys(library).length) { resetToUpload(); return; }
        showFeedView();
      }
    });
    libraryBooks.appendChild(pill);
  });
}

function getAllPosts() {
  if (activeSource === 'all') {
    var all = [];
    Object.keys(library).forEach(function(key) {
      all = all.concat(library[key].posts);
    });
    return all;
  }
  return library[activeSource] ? library[activeSource].posts : [];
}

function showFeedView() {
  uploadSection.hidden = true;
  filterBar.hidden = false;
  feed.hidden = false;
  libraryBar.hidden = false;
  renderLibrary();
  updateSourceInfo();
  renderPosts();
}

function updateSourceInfo() {
  var posts = getAllPosts();
  var counts = { funny: 0, learning: 0, information: 0 };
  posts.forEach(function(p) { counts[p.category]++; });
  var liked = preferences.likedIds.filter(function(id) { return posts.some(function(p) { return p.id === id; }); }).length;
  var srcName = activeSource === 'all' ? 'All Books' : (library[activeSource] ? library[activeSource].name : '');
  var pages = activeSource === 'all'
    ? Object.values(library).reduce(function(s, src) { return s + src.pages; }, 0)
    : (library[activeSource] ? library[activeSource].pages : 0);

  sourceInfo.innerHTML =
    '<strong>' + escapeHtml(srcName) + '</strong> &middot; ' + pages + ' pg &middot; ' + posts.length + ' posts' +
    ' &nbsp;|&nbsp; <span style="color:#ef4444">&#128516; ' + counts.funny + '</span> &middot; ' +
    '<span style="color:#8b5cf6">&#129504; ' + counts.learning + '</span> &middot; ' +
    '<span style="color:#3b82f6">&#128240; ' + counts.information + '</span>' +
    (liked > 0 ? ' &middot; <span style="color:#22c55e">&#10084;&#65039; ' + liked + '</span>' : '');
}

function resetToUpload() {
  currentFilter = 'all';
  activeSource = 'all';
  fileInput.value = '';
  uploadSection.hidden = false;
  uploadArea.hidden = false;
  processing.hidden = true;
  filterBar.hidden = true;
  feed.hidden = true;
  emptyState.hidden = true;
  libraryBar.hidden = true;
  feedGrid.innerHTML = '';
  document.getElementById('welcomeMsg').hidden = false;
  document.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
  document.querySelector('[data-filter="all"]').classList.add('active');
}

// ── Render posts ──
function renderPosts() {
  feedGrid.innerHTML = '';
  var posts = getAllPosts();

  if (currentFilter === 'liked') posts = posts.filter(function(p) { return preferences.likedIds.indexOf(p.id) !== -1; });
  else if (currentFilter !== 'all') posts = posts.filter(function(p) { return p.category === currentFilter; });

  if (smartMode && currentFilter !== 'liked') posts = posts.filter(function(p) { return !shouldHidePost(p); });

  posts.sort(function(a, b) {
    var al = preferences.likedIds.indexOf(a.id) !== -1 ? 1 : 0;
    var bl = preferences.likedIds.indexOf(b.id) !== -1 ? 1 : 0;
    if (al !== bl) return bl - al;
    return scorePost(b) - scorePost(a);
  });

  if (!posts.length) { emptyState.hidden = false; feed.hidden = true; return; }
  emptyState.hidden = true; feed.hidden = false;
  posts.forEach(function(post, i) { feedGrid.appendChild(createPostCard(post, i)); });
}

// ── Create card ──
function createPostCard(post, index) {
  var card = document.createElement('article');
  card.className = 'post-card';
  card.dataset.category = post.category;
  card.dataset.type = post.type;
  card.dataset.id = post.id;
  card.style.animationDelay = Math.min(index * 0.06, 0.8) + 's';

  var palette = getCardPalette(post, index);
  card.style.background = palette.bg;
  card.style.borderLeft = '4px solid ' + palette.border;

  var isLiked = preferences.likedIds.indexOf(post.id) !== -1;
  var isDisliked = preferences.dislikedIds.indexOf(post.id) !== -1;
  var score = scorePost(post);

  var catEmoji = { funny: '&#128516;', learning: '&#129504;', information: '&#128240;' };
  var typeLabel = { quote: '&#128172; Quote', insight: '&#128161; Insight', tip: '&#128204; Tip' };

  card.innerHTML =
    '<div class="post-card-header"><div class="post-gradient-bar"></div></div>' +
    (score > 10 ? '<div class="score-badge high">&#9733; For you</div>' : '') +
    '<div class="post-meta">' +
      '<span class="post-category-badge">' + (catEmoji[post.category] || '') + ' ' + post.category + '</span>' +
      '<span class="post-type-badge">' + (typeLabel[post.type] || post.type) + '</span>' +
    '</div>' +
    '<div class="post-content">' + escapeHtml(post.content) + '</div>' +
    '<div class="post-footer">' +
      '<span class="post-source"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> ' + escapeHtml(post.source) + '</span>' +
      '<div class="post-actions">' +
        '<button class="action-btn like-action' + (isLiked ? ' liked' : '') + '" title="Like"><svg width="20" height="20" viewBox="0 0 24 24" fill="' + (isLiked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button>' +
        '<button class="action-btn dislike-action' + (isDisliked ? ' disliked' : '') + '" title="Dislike"><svg width="20" height="20" viewBox="0 0 24 24" fill="' + (isDisliked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg></button>' +
        '<button class="action-btn copy-action" title="Copy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
      '</div>' +
    '</div>';

  card.querySelector('.like-action').addEventListener('click', function() {
    var btn = this;
    if (preferences.likedIds.indexOf(post.id) !== -1) {
      preferences.likedIds = preferences.likedIds.filter(function(id) { return id !== post.id; });
      btn.classList.remove('liked');
      btn.querySelector('svg').setAttribute('fill', 'none');
      showToast('Removed from liked');
    } else {
      learnFromAction(post, 'like');
      btn.classList.add('liked');
      btn.querySelector('svg').setAttribute('fill', 'currentColor');
      var dis = card.querySelector('.dislike-action');
      dis.classList.remove('disliked');
      dis.querySelector('svg').setAttribute('fill', 'none');
      animateButton(btn);
      showToast('Liked! Showing more like this');
    }
    savePreferences();
    updateSourceInfo();
  });

  card.querySelector('.dislike-action').addEventListener('click', function() {
    learnFromAction(post, 'dislike');
    card.classList.add('removing');
    showToast('Got it! Showing less like this');
    setTimeout(function() { card.remove(); updateSourceInfo(); }, 400);
  });

  card.querySelector('.copy-action').addEventListener('click', function() {
    var btn = this;
    navigator.clipboard.writeText(post.content).then(function() {
      btn.style.color = '#22c55e';
      setTimeout(function() { btn.style.color = ''; }, 1000);
    });
  });

  return card;
}

// ── Helpers ──
var toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.hidden = true; }, 2000);
}

function animateButton(btn) {
  btn.style.transform = 'scale(1.3)';
  setTimeout(function() { btn.style.transform = 'scale(1)'; }, 200);
}

function escapeHtml(str) {
  var d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════

var savedUser = getCurrentUser();
if (savedUser && userExists(savedUser)) {
  enterApp(savedUser);
} else {
  clearCurrentUser();
  showLogin();
}
