if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ══════════════════════════════════════
//  USER SYSTEM
// ══════════════════════════════════════

var AVATAR_COLORS = [
  '#ef4444','#f97316','#eab308','#22c55e','#06b6d4',
  '#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899',
];

function getAvatarColor(username) {
  var hash = 0;
  for (var i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(u) { return u.substring(0, 2).toUpperCase(); }

function getAllUsers() {
  try { return JSON.parse(localStorage.getItem('pg_users') || '{}'); } catch(e) { return {}; }
}
function saveAllUsers(u) { try { localStorage.setItem('pg_users', JSON.stringify(u)); } catch(e) {} }
function getCurrentUser() { try { return localStorage.getItem('pg_current_user'); } catch(e) { return null; } }
function setCurrentUser(u) { try { localStorage.setItem('pg_current_user', u); } catch(e) {} }
function clearCurrentUser() { try { localStorage.removeItem('pg_current_user'); } catch(e) {} }

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
  try { localStorage.removeItem('pg_lib_' + username); localStorage.removeItem('pg_prefs_' + username); } catch(e) {}
}

function userExists(u) { return u in getAllUsers(); }
function getUserLibrary(u) {
  try { return JSON.parse(localStorage.getItem('pg_lib_' + u) || '{}'); } catch(e) { return {}; }
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

function isValidUsername(u) { return /^[a-zA-Z0-9_]{3,20}$/.test(u); }

usernameInput.addEventListener('input', function() {
  var val = usernameInput.value.trim();
  usernameHint.classList.remove('error', 'success');
  if (val.length === 0) {
    usernameHint.textContent = 'Letters, numbers & underscores. 3-20 chars.';
    loginBtn.disabled = true; return;
  }
  if (!isValidUsername(val)) {
    usernameHint.textContent = 'Only letters, numbers & underscores. Min 3 chars.';
    usernameHint.classList.add('error'); loginBtn.disabled = true; return;
  }
  if (userExists(val)) {
    usernameHint.textContent = 'Welcome back, ' + val + '!';
    usernameHint.classList.add('success'); loginBtnText.textContent = 'Continue';
  } else {
    usernameHint.textContent = 'New account will be created';
    usernameHint.classList.add('success'); loginBtnText.textContent = 'Get Started';
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
    if (!userExists(username)) { createUser(username); }
    else { var u = getAllUsers(); u[username].lastLogin = Date.now(); saveAllUsers(u); }
    setCurrentUser(username);
    enterApp(username);
  } catch(err) { console.error('Login error:', err); alert('Error: ' + err.message); }
}

function renderExistingUsers() {
  var users = getAllUsers();
  var names = Object.keys(users).sort(function(a, b) { return (users[b].lastLogin || 0) - (users[a].lastLogin || 0); });
  if (names.length === 0) { existingUsersSection.hidden = true; return; }
  existingUsersSection.hidden = false;
  userPillsContainer.innerHTML = '';
  names.forEach(function(name) {
    var pill = document.createElement('button');
    pill.className = 'user-pill';
    var lib = getUserLibrary(name);
    var pc = Object.values(lib).reduce(function(s, src) { return s + src.posts.length; }, 0);
    pill.innerHTML =
      '<span class="pill-avatar" style="background:' + getAvatarColor(name) + '">' + getInitials(name) + '</span>' +
      '<span>' + escapeHtml(name) + '</span>' +
      (pc > 0 ? '<span class="pill-stats">' + pc + ' posts</span>' : '') +
      '<span class="pill-remove" title="Delete">&times;</span>';
    pill.addEventListener('click', function(e) {
      if (e.target.classList.contains('pill-remove')) return;
      var u = getAllUsers(); u[name].lastLogin = Date.now(); saveAllUsers(u);
      setCurrentUser(name); enterApp(name);
    });
    pill.querySelector('.pill-remove').addEventListener('click', function(e) {
      e.stopPropagation();
      if (confirm('Delete "' + name + '" and all data?')) {
        deleteUser(name); if (getCurrentUser() === name) clearCurrentUser(); renderExistingUsers();
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
  loginBtn.disabled = true; loginBtnText.textContent = 'Get Started';
  renderExistingUsers();
  setTimeout(function() { usernameInput.focus(); }, 100);
}

// ══════════════════════════════════════
//  MAIN APP STATE
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
  document.getElementById('userAvatar').textContent = getInitials(username);
  document.getElementById('userAvatar').style.background = getAvatarColor(username);
  document.getElementById('userName').textContent = username;
  loadUserData();
  var wm = document.getElementById('welcomeMsg');
  var bc = Object.keys(library).length;
  wm.innerHTML = bc > 0
    ? '<h2>Hey, ' + escapeHtml(username) + '!</h2><p>' + bc + ' book' + (bc > 1 ? 's' : '') + ' in your library</p>'
    : '<h2>Welcome, ' + escapeHtml(username) + '!</h2><p>Upload your first PDF to get started</p>';
  if (bc > 0) { activeSource = 'all'; showFeedView(); }
  else { resetToUpload(); }
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

// ── Persistence ──
function saveLibrary() {
  if (!currentUser) return;
  try { localStorage.setItem('pg_lib_' + currentUser, JSON.stringify(library)); } catch(e) {}
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

// ══════════════════════════════════════
//  GENERATIVE COVER ART
// ══════════════════════════════════════

var ART_THEMES = {
  funny: {
    colors: [['#ff6b6b','#ee5a24','#f8b500'],['#fd79a8','#e17055','#fdcb6e'],['#ff9ff3','#f368e0','#ff6348']],
    emoji: ['&#128514;','&#129315;','&#128523;','&#127912;','&#127881;','&#128131;','&#129313;','&#128526;']
  },
  learning: {
    colors: [['#6c5ce7','#a29bfe','#74b9ff'],['#0984e3','#00cec9','#55efc4'],['#6366f1','#818cf8','#c084fc']],
    emoji: ['&#128218;','&#129504;','&#128161;','&#127891;','&#128300;','&#9999;&#65039;','&#128640;','&#127793;']
  },
  information: {
    colors: [['#00b894','#00cec9','#0984e3'],['#2d3436','#636e72','#00b894'],['#0891b2','#06b6d4','#22d3ee']],
    emoji: ['&#128240;','&#127758;','&#128200;','&#128269;','&#128161;','&#128188;','&#128202;','&#9889;']
  }
};

function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generateCoverSVG(post) {
  var theme = ART_THEMES[post.category] || ART_THEMES.information;
  var seed = hashStr(post.id + post.content.substring(0, 30));
  var palette = theme.colors[seed % theme.colors.length];
  var c1 = palette[0], c2 = palette[1], c3 = palette[2];

  var shapes = '';
  var style = seed % 5;

  if (style === 0) {
    for (var i = 0; i < 6; i++) {
      var cx = 50 + ((seed * (i + 3) * 17) % 350);
      var cy = 20 + ((seed * (i + 7) * 13) % 140);
      var r = 20 + ((seed * (i + 1)) % 60);
      var col = [c1, c2, c3][i % 3];
      shapes += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + col + '" opacity="0.3"/>';
    }
  } else if (style === 1) {
    for (var i = 0; i < 5; i++) {
      var x = ((seed * (i + 2) * 19) % 400);
      var w = 40 + ((seed * (i + 1)) % 80);
      var col = [c1, c2, c3][i % 3];
      shapes += '<rect x="' + x + '" y="0" width="' + w + '" height="200" fill="' + col + '" opacity="0.25" transform="rotate(' + (15 + i * 12) + ' ' + (x + w/2) + ' 100)"/>';
    }
  } else if (style === 2) {
    var pts = '';
    for (var i = 0; i <= 8; i++) {
      pts += (i * 60) + ',' + (80 + Math.sin(seed + i * 0.8) * 50) + ' ';
    }
    shapes += '<polyline points="' + pts + '" fill="none" stroke="' + c2 + '" stroke-width="3" opacity="0.5"/>';
    pts = '';
    for (var i = 0; i <= 8; i++) {
      pts += (i * 60) + ',' + (100 + Math.cos(seed + i * 0.6) * 40) + ' ';
    }
    shapes += '<polyline points="' + pts + '" fill="none" stroke="' + c3 + '" stroke-width="2" opacity="0.4"/>';
    for (var i = 0; i < 8; i++) {
      var cx = 30 + ((seed * (i + 4) * 11) % 420);
      var cy = 30 + ((seed * (i + 2) * 7) % 120);
      shapes += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (4 + i % 5) + '" fill="' + [c1,c2,c3][i%3] + '" opacity="0.6"/>';
    }
  } else if (style === 3) {
    for (var i = 0; i < 4; i++) {
      var x = 60 + i * 110;
      var y = 40 + ((seed * (i + 3)) % 80);
      var s = 30 + ((seed * (i + 1)) % 50);
      var col = [c1, c2, c3, c1][i];
      shapes += '<rect x="' + (x - s/2) + '" y="' + (y - s/2) + '" width="' + s + '" height="' + s + '" rx="6" fill="' + col + '" opacity="0.3" transform="rotate(' + ((seed * i) % 45) + ' ' + x + ' ' + y + ')"/>';
    }
  } else {
    for (var i = 0; i < 3; i++) {
      var cx = 120 + i * 130;
      var cy = 90;
      var r1 = 40 + ((seed * (i + 1)) % 40);
      var r2 = 30 + ((seed * (i + 3)) % 30);
      shapes += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r1 + '" ry="' + r2 + '" fill="' + [c1,c2,c3][i] + '" opacity="0.25" transform="rotate(' + ((seed * (i+2)) % 60) + ' ' + cx + ' ' + cy + ')"/>';
    }
  }

  var emoji = theme.emoji[seed % theme.emoji.length];

  return {
    svg: '<svg viewBox="0 0 480 180" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="bg' + seed + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" style="stop-color:' + c1 + ';stop-opacity:0.15"/>' +
      '<stop offset="100%" style="stop-color:' + c3 + ';stop-opacity:0.25"/>' +
      '</linearGradient></defs>' +
      '<rect width="480" height="180" fill="url(#bg' + seed + ')"/>' +
      shapes + '</svg>',
    emoji: emoji
  };
}

// ══════════════════════════════════════
//  SMARTER CONTENT EXTRACTION
// ══════════════════════════════════════

var STOP_WORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','each','every','both','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','that','this','these','those','it','its','they','them','their','he','she','his','her','we','our','you','your','i','me','my','what','which','who','whom','whose','about','also','up','one','two','three','many','much','like','get','got','make','made','take','new','know','see','come','think','look','want','give','use','find','tell','ask','work','seem','feel','try','leave','call','said','went','still','well','back','even','us','way','say','go','going','page','chapter','figure','table','copyright','isbn','publisher','edition','press','printed','reserved','rights','author']);

function extractKeywords(text) {
  return text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
    .filter(function(w) { return w.length > 3 && !STOP_WORDS.has(w); });
}

var CATEGORY_KEYWORDS = {
  funny: ['joke','humor','laugh','funny','comedy','hilarious','wit','sarcasm','irony','pun','satire','absurd','ridiculous','amusing','comical','fool','silly','nonsense','parody','mock','bizarre','crazy','weird','strange','awkward','embarrass','prank','trick','surprise','unexpected','twist'],
  learning: ['learn','study','research','theory','principle','concept','method','technique','strategy','framework','lesson','education','knowledge','understand','discover','experiment','hypothesis','analysis','insight','skill','practice','develop','improve','growth','teach','science','formula','equation','theorem','definition','rule','process','system','approach','model','evidence','conclusion','observe','measure','explain','demonstrate'],
  information: ['report','data','statistic','fact','news','update','announce','according','survey','percent','million','billion','government','policy','economy','market','industry','company','organization','country','world','global','national','international','official','source','history','event','population','crisis','conflict','agreement','decision','result','impact','change','trend','growth','decline','increase']
};

function categorizeText(text) {
  var lower = text.toLowerCase();
  var scores = { funny: 0, learning: 0, information: 0 };
  Object.keys(CATEGORY_KEYWORDS).forEach(function(cat) {
    CATEGORY_KEYWORDS[cat].forEach(function(kw) {
      if (lower.indexOf(kw) !== -1) scores[cat] += 1;
    });
  });
  var max = Math.max(scores.funny, scores.learning, scores.information);
  if (max === 0) return 'information';
  if (scores.funny >= scores.learning && scores.funny >= scores.information) return 'funny';
  if (scores.learning >= scores.information) return 'learning';
  return 'information';
}

function qualityScore(text) {
  var score = 0;
  if (text.length >= 60 && text.length <= 400) score += 3;
  else if (text.length >= 40 && text.length <= 600) score += 1;
  else return -10;

  var sentences = text.split(/[.!?]+/).filter(function(s) { return s.trim().length > 10; });
  if (sentences.length >= 1 && sentences.length <= 5) score += 2;

  var firstWord = text.trim().split(/\s/)[0] || '';
  if (/^[A-Z]/.test(firstWord)) score += 1;

  var hasEnding = /[.!?]["'”]?\s*$/.test(text.trim());
  if (hasEnding) score += 2;

  var junkPatterns = /^\d+\s*$|^[A-Z\s]{2,}$|copyright|all rights|isbn|acknowledgment|table of contents|bibliography|appendix|index\s*$/i;
  if (junkPatterns.test(text.trim())) return -10;

  var signal = /important|key|significant|essential|crucial|remarkable|notable|interesting|surprising|powerful|discover|reveal|transform|impact|secret|truth|reality|actually|however|nevertheless|contrary|unexpected|fascinating|striking|extraordinary/gi;
  var matches = text.match(signal);
  if (matches) score += Math.min(matches.length * 2, 6);

  return score;
}

function generatePosts(text, sourceTitle, sourceId) {
  var posts = [];
  var seen = new Set();

  function addPost(content, type) {
    content = content.replace(/\s+/g, ' ').trim();
    if (content.length < 40 || content.length > 700) return;
    var key = content.substring(0, 60).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    posts.push({
      id: sourceId + '-' + posts.length,
      content: content,
      category: categorizeText(content),
      type: type,
      source: sourceTitle,
      sourceId: sourceId
    });
  }

  // 1. Extract quotes
  var quoteRe = /[""„‟“]([^"""„”]{25,250})[""„‟”]/g;
  var qm;
  while ((qm = quoteRe.exec(text)) !== null) {
    if (posts.length >= 15) break;
    var q = qm[1].trim();
    if (qualityScore(q) >= 0) addPost(q, 'quote');
  }

  // 2. Extract meaningful paragraphs
  var paragraphs = text.split(/\n\s*\n/)
    .map(function(p) { return p.replace(/\s+/g, ' ').trim(); })
    .filter(function(p) { return p.length > 60 && p.length < 2000; });

  var scored = paragraphs.map(function(p) {
    return { text: p, score: qualityScore(p) };
  }).filter(function(x) { return x.score >= 2; })
    .sort(function(a, b) { return b.score - a.score; });

  scored.forEach(function(item) {
    if (posts.length >= 60) return;
    var p = item.text;

    if (p.length <= 500) {
      addPost(p, 'insight');
      return;
    }

    var sents = p.replace(/([.!?])\s+/g, '$1\n').split('\n')
      .map(function(s) { return s.trim(); })
      .filter(function(s) { return s.length > 20 && s.length < 400; });

    if (sents.length === 0) return;

    var bestSents = sents.map(function(s) { return { text: s, score: qualityScore(s) }; })
      .sort(function(a, b) { return b.score - a.score; })
      .slice(0, 3)
      .sort(function(a, b) { return p.indexOf(a.text) - p.indexOf(b.text); });

    var combined = bestSents.map(function(s) { return s.text; }).join(' ');
    if (combined.length >= 40 && combined.length <= 600) {
      addPost(combined, 'insight');
    }
  });

  // 3. Extract list items / tips
  var listRe = /(?:^|\n)\s*(?:\d+[.)]\s|[-•*]\s)(.{25,350})/g;
  var lm;
  while ((lm = listRe.exec(text)) !== null) {
    if (posts.length >= 80) break;
    var cleaned = lm[1].trim();
    if (qualityScore(cleaned) >= 0) addPost(cleaned, 'tip');
  }

  // 4. Find standalone interesting sentences from remaining text
  var allSentences = text.replace(/([.!?])\s+/g, '$1\n').split('\n')
    .map(function(s) { return s.replace(/\s+/g, ' ').trim(); })
    .filter(function(s) { return s.length > 50 && s.length < 350; });

  allSentences.forEach(function(s) {
    if (posts.length >= 90) return;
    if (qualityScore(s) >= 4) addPost(s, 'insight');
  });

  // Shuffle with Fisher-Yates
  for (var i = posts.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = posts[i]; posts[i] = posts[j]; posts[j] = temp;
  }

  return posts;
}

// ══════════════════════════════════════
//  SMART FEED (IMPROVED)
// ══════════════════════════════════════

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
  if (preferences.likedIds.indexOf(post.id) !== -1) return 50;
  if (preferences.dislikedIds.indexOf(post.id) !== -1) return -100;
  var score = 0;
  var keywords = extractKeywords(post.content);
  keywords.forEach(function(w) {
    score += (preferences.likedKeywords[w] || 0);
    score -= (preferences.dislikedKeywords[w] || 0) * 2;
  });
  score += (preferences.likedCategories[post.category] || 0) * 2;
  score -= (preferences.dislikedCategories[post.category] || 0) * 3;
  score += (preferences.likedTypes[post.type] || 0);
  score -= (preferences.dislikedTypes[post.type] || 0) * 2;
  return score;
}

function shouldHidePost(post) {
  return preferences.dislikedIds.indexOf(post.id) !== -1;
}

// ══════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════

uploadArea.addEventListener('click', function() { fileInput.click(); });
uploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', function() { uploadArea.classList.remove('drag-over'); });
uploadArea.addEventListener('drop', function(e) {
  e.preventDefault(); uploadArea.classList.remove('drag-over');
  var f = e.dataTransfer.files[0];
  if (f && f.type === 'application/pdf') handleFile(f);
});
fileInput.addEventListener('change', function(e) { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; });
fileInputLibrary.addEventListener('change', function(e) { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; });
addBookBtn.addEventListener('click', function() { fileInputLibrary.click(); });

document.getElementById('logoutBtn').addEventListener('click', function() {
  clearCurrentUser(); currentUser = null; library = {}; preferences = {}; showLogin();
});
smartFilterCheckbox.addEventListener('change', function() { smartMode = smartFilterCheckbox.checked; renderPosts(); });
clearDataBtn.addEventListener('click', function() {
  if (confirm('Reset preferences for ' + currentUser + '? Your PDFs stay.')) {
    preferences = { likedKeywords:{}, dislikedKeywords:{}, likedCategories:{}, dislikedCategories:{}, likedTypes:{}, dislikedTypes:{}, likedIds:[], dislikedIds:[] };
    savePreferences(); showToast('Preferences reset'); renderPosts();
  }
});
document.querySelectorAll('.chip').forEach(function(chip) {
  chip.addEventListener('click', function() {
    document.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active'); currentFilter = chip.dataset.filter; renderPosts();
  });
});

// ══════════════════════════════════════
//  PDF PROCESSING
// ══════════════════════════════════════

function updateProcessing(opts) {
  processingTitle.textContent = opts.title;
  processingSubtitle.textContent = opts.subtitle;
  progressFill.style.width = opts.progress + '%';
}

function extractTextFromPDF(arrayBuffer) {
  if (typeof pdfjsLib === 'undefined') return Promise.reject(new Error('PDF library not loaded. Refresh the page.'));
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise.then(function(pdf) {
    var total = pdf.numPages, fullText = '', chain = Promise.resolve();
    for (var i = 1; i <= total; i++) {
      (function(pn) {
        chain = chain.then(function() {
          if (pn % 10 === 0 || pn === 1) {
            updateProcessing({ title: 'Reading page ' + pn + '/' + total, subtitle: Math.round(pn/total*100) + '%', progress: Math.round(pn/total*60) });
          }
          return pdf.getPage(pn).then(function(pg) {
            return pg.getTextContent().then(function(c) {
              fullText += c.items.map(function(it) { return it.str; }).join(' ') + '\n\n';
            });
          });
        });
      })(i);
    }
    return chain.then(function() { return { text: fullText, numPages: total }; });
  });
}

function handleFile(file) {
  uploadSection.hidden = false; uploadArea.hidden = true; processing.hidden = false;
  document.getElementById('welcomeMsg').hidden = true;
  updateProcessing({ title: 'Reading your PDF...', subtitle: 'Loading', progress: 5 });

  file.arrayBuffer().then(function(buf) {
    updateProcessing({ title: 'Parsing pages...', subtitle: 'Extracting text', progress: 15 });
    return extractTextFromPDF(buf);
  }).then(function(result) {
    updateProcessing({ title: 'Creating posts...', subtitle: 'Finding the best content', progress: 75 });

    var title = file.name.replace(/\.pdf$/i, '');
    var sid = 'src-' + Date.now();
    var posts = generatePosts(result.text, title, sid);

    library[sid] = { name: title, pages: result.numPages, posts: posts, addedAt: Date.now() };
    saveLibrary();

    updateProcessing({ title: 'Done!', subtitle: posts.length + ' posts from ' + result.numPages + ' pages', progress: 100 });
    setTimeout(function() { activeSource = 'all'; showFeedView(); }, 800);
  }).catch(function(err) {
    console.error('PDF error:', err);
    processingTitle.textContent = 'Oops!';
    processingSubtitle.textContent = err.message || 'Could not read this PDF.';
    progressFill.style.width = '0%';
    setTimeout(function() { processing.hidden = true; uploadArea.hidden = false; document.getElementById('welcomeMsg').hidden = false; }, 2500);
  });
}

// ══════════════════════════════════════
//  LIBRARY & FEED
// ══════════════════════════════════════

function renderLibrary() {
  libraryBooks.innerHTML = '';
  var sources = Object.entries(library).sort(function(a, b) { return b[1].addedAt - a[1].addedAt; });
  if (sources.length === 0) { libraryBar.hidden = true; return; }
  libraryBar.hidden = false;

  var allPill = document.createElement('button');
  allPill.className = 'book-pill book-pill-all' + (activeSource === 'all' ? ' active' : '');
  var total = sources.reduce(function(s, e) { return s + e[1].posts.length; }, 0);
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
      activeSource = id; showFeedView();
    });
    pill.querySelector('.book-remove').addEventListener('click', function(e) {
      e.stopPropagation();
      if (confirm('Remove "' + src.name + '"?')) {
        delete library[id]; saveLibrary();
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
    Object.keys(library).forEach(function(k) { all = all.concat(library[k].posts); });
    return all;
  }
  return library[activeSource] ? library[activeSource].posts : [];
}

function showFeedView() {
  uploadSection.hidden = true; filterBar.hidden = false; feed.hidden = false; libraryBar.hidden = false;
  renderLibrary(); updateSourceInfo(); renderPosts();
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
  currentFilter = 'all'; activeSource = 'all'; fileInput.value = '';
  uploadSection.hidden = false; uploadArea.hidden = false;
  processing.hidden = true; filterBar.hidden = true;
  feed.hidden = true; emptyState.hidden = true; libraryBar.hidden = true;
  feedGrid.innerHTML = '';
  document.getElementById('welcomeMsg').hidden = false;
  document.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
  document.querySelector('[data-filter="all"]').classList.add('active');
}

function renderPosts() {
  feedGrid.innerHTML = '';
  var posts = getAllPosts();

  if (currentFilter === 'liked') {
    posts = posts.filter(function(p) { return preferences.likedIds.indexOf(p.id) !== -1; });
  } else if (currentFilter !== 'all') {
    posts = posts.filter(function(p) { return p.category === currentFilter; });
  }

  // Smart feed: hide only explicitly disliked, then boost liked-similar to top
  if (smartMode) {
    posts = posts.filter(function(p) { return !shouldHidePost(p); });
  }

  // Sort: liked first, then by smart score, then shuffle the rest
  var liked = [], scored = [], rest = [];
  posts.forEach(function(p) {
    var s = scorePost(p);
    if (preferences.likedIds.indexOf(p.id) !== -1) liked.push(p);
    else if (s > 3) scored.push({ post: p, score: s });
    else rest.push(p);
  });

  scored.sort(function(a, b) { return b.score - a.score; });

  // Shuffle the rest so feed feels fresh
  for (var i = rest.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp;
  }

  var final = liked.concat(scored.map(function(x) { return x.post; })).concat(rest);

  if (!final.length) { emptyState.hidden = false; feed.hidden = true; return; }
  emptyState.hidden = true; feed.hidden = false;
  final.forEach(function(post, i) { feedGrid.appendChild(createPostCard(post, i)); });
}

// ══════════════════════════════════════
//  POST CARD WITH COVER ART
// ══════════════════════════════════════

function createPostCard(post, index) {
  var card = document.createElement('article');
  card.className = 'post-card';
  card.dataset.category = post.category;
  card.dataset.type = post.type;
  card.dataset.id = post.id;
  card.style.animationDelay = Math.min(index * 0.05, 0.6) + 's';

  var isLiked = preferences.likedIds.indexOf(post.id) !== -1;
  var isDisliked = preferences.dislikedIds.indexOf(post.id) !== -1;
  var score = scorePost(post);

  var cover = generateCoverSVG(post);
  var catEmoji = { funny: '&#128516;', learning: '&#129504;', information: '&#128240;' };
  var typeLabel = { quote: '&#128172; Quote', insight: '&#128161; Insight', tip: '&#128204; Tip' };
  var catLabel = { funny: 'Funny', learning: 'Learning', information: 'Info' };

  card.innerHTML =
    '<div class="post-cover">' +
      cover.svg +
      '<span class="post-cover-emoji">' + cover.emoji + '</span>' +
      '<span class="post-cover-title">' + escapeHtml(post.source) + '</span>' +
    '</div>' +
    (score > 5 && !isLiked ? '<div class="score-badge high">&#9733; Recommended</div>' : '') +
    '<div class="post-meta">' +
      '<span class="post-category-badge">' + (catEmoji[post.category] || '') + ' ' + (catLabel[post.category] || post.category) + '</span>' +
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
      btn.classList.remove('liked'); btn.querySelector('svg').setAttribute('fill', 'none');
      showToast('Removed from liked');
    } else {
      learnFromAction(post, 'like');
      btn.classList.add('liked'); btn.querySelector('svg').setAttribute('fill', 'currentColor');
      var dis = card.querySelector('.dislike-action');
      dis.classList.remove('disliked'); dis.querySelector('svg').setAttribute('fill', 'none');
      animateButton(btn);
      showToast('Liked! Similar posts boosted');
    }
    savePreferences(); updateSourceInfo();
  });

  card.querySelector('.dislike-action').addEventListener('click', function() {
    learnFromAction(post, 'dislike');
    card.classList.add('removing');
    showToast('Hidden. Less like this');
    setTimeout(function() { card.remove(); updateSourceInfo(); }, 400);
  });

  card.querySelector('.copy-action').addEventListener('click', function() {
    var btn = this;
    navigator.clipboard.writeText(post.content).then(function() {
      btn.style.color = '#22c55e';
      setTimeout(function() { btn.style.color = ''; }, 1000);
      showToast('Copied!');
    });
  });

  return card;
}

// ── Helpers ──
var toastTimer;
function showToast(msg) {
  toast.textContent = msg; toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toast.hidden = true; }, 2000);
}
function animateButton(btn) {
  btn.style.transform = 'scale(1.3)';
  setTimeout(function() { btn.style.transform = 'scale(1)'; }, 200);
}
function escapeHtml(str) {
  var d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
var savedUser = getCurrentUser();
if (savedUser && userExists(savedUser)) { enterApp(savedUser); }
else { clearCurrentUser(); showLogin(); }
