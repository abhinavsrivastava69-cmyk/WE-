if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ══════════════════════════════════════
//  USER SYSTEM
// ══════════════════════════════════════

var AVATAR_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899'];

function getAvatarColor(u) { var h=0; for(var i=0;i<u.length;i++) h=u.charCodeAt(i)+((h<<5)-h); return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length]; }
function getInitials(u) { return u.substring(0,2).toUpperCase(); }
function getAllUsers() { try { return JSON.parse(localStorage.getItem('pg_users')||'{}'); } catch(e) { return {}; } }
function saveAllUsers(u) { try { localStorage.setItem('pg_users',JSON.stringify(u)); } catch(e) {} }
function getCurrentUser() { try { return localStorage.getItem('pg_current_user'); } catch(e) { return null; } }
function setCurrentUser(u) { try { localStorage.setItem('pg_current_user',u); } catch(e) {} }
function clearCurrentUser() { try { localStorage.removeItem('pg_current_user'); } catch(e) {} }

function createUser(username) {
  var users = getAllUsers();
  users[username] = { createdAt: Date.now(), lastLogin: Date.now() };
  saveAllUsers(users);
  try {
    localStorage.setItem('pg_lib_' + username, JSON.stringify({}));
    localStorage.setItem('pg_prefs_' + username, JSON.stringify({
      likedKeywords:{}, dislikedKeywords:{}, likedCategories:{}, dislikedCategories:{},
      likedTypes:{}, dislikedTypes:{}, likedIds:[], dislikedIds:[]
    }));
  } catch(e) {}
}

function deleteUser(username) {
  var users = getAllUsers(); delete users[username]; saveAllUsers(users);
  try { localStorage.removeItem('pg_lib_'+username); localStorage.removeItem('pg_prefs_'+username); } catch(e) {}
}

function userExists(u) { return u in getAllUsers(); }
function getUserLibrary(u) { try { return JSON.parse(localStorage.getItem('pg_lib_'+u)||'{}'); } catch(e) { return {}; } }

// ══════════════════════════════════════
//  LOGIN
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
  usernameHint.classList.remove('error','success');
  if (!val.length) { usernameHint.textContent='Letters, numbers & underscores. 3-20 chars.'; loginBtn.disabled=true; return; }
  if (!isValidUsername(val)) { usernameHint.textContent='Only letters, numbers & underscores. Min 3 chars.'; usernameHint.classList.add('error'); loginBtn.disabled=true; return; }
  if (userExists(val)) { usernameHint.textContent='Welcome back, '+val+'!'; usernameHint.classList.add('success'); loginBtnText.textContent='Continue'; }
  else { usernameHint.textContent='New account will be created'; usernameHint.classList.add('success'); loginBtnText.textContent='Get Started'; }
  loginBtn.disabled = false;
});
usernameInput.addEventListener('keydown', function(e) { if(e.key==='Enter'&&!loginBtn.disabled) doLogin(); });
loginBtn.addEventListener('click', doLogin);

function doLogin() {
  try {
    var username = usernameInput.value.trim();
    if (!isValidUsername(username)) return;
    if (!userExists(username)) createUser(username);
    else { var u=getAllUsers(); u[username].lastLogin=Date.now(); saveAllUsers(u); }
    setCurrentUser(username); enterApp(username);
  } catch(err) { console.error(err); alert('Error: '+err.message); }
}

function renderExistingUsers() {
  var users=getAllUsers(), names=Object.keys(users).sort(function(a,b){return(users[b].lastLogin||0)-(users[a].lastLogin||0);});
  if(!names.length){existingUsersSection.hidden=true;return;}
  existingUsersSection.hidden=false; userPillsContainer.innerHTML='';
  names.forEach(function(name){
    var pill=document.createElement('button'); pill.className='user-pill';
    var lib=getUserLibrary(name), pc=Object.values(lib).reduce(function(s,src){return s+src.posts.length;},0);
    pill.innerHTML='<span class="pill-avatar" style="background:'+getAvatarColor(name)+'">'+getInitials(name)+'</span><span>'+escapeHtml(name)+'</span>'+(pc>0?'<span class="pill-stats">'+pc+' posts</span>':'')+'<span class="pill-remove">&times;</span>';
    pill.addEventListener('click',function(e){if(e.target.classList.contains('pill-remove'))return;var u=getAllUsers();u[name].lastLogin=Date.now();saveAllUsers(u);setCurrentUser(name);enterApp(name);});
    pill.querySelector('.pill-remove').addEventListener('click',function(e){e.stopPropagation();if(confirm('Delete "'+name+'"?')){deleteUser(name);if(getCurrentUser()===name)clearCurrentUser();renderExistingUsers();}});
    userPillsContainer.appendChild(pill);
  });
}

function showLogin() {
  loginScreen.style.display='flex'; mainApp.style.display='none';
  usernameInput.value=''; usernameHint.textContent='Letters, numbers & underscores. 3-20 chars.';
  usernameHint.classList.remove('error','success'); loginBtn.disabled=true; loginBtnText.textContent='Get Started';
  renderExistingUsers(); setTimeout(function(){usernameInput.focus();},100);
}

// ══════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════

var currentUser=null, library={}, preferences={}, currentFilter='all', activeSource='all', smartMode=true;

function enterApp(username) {
  currentUser=username; loginScreen.style.display='none'; mainApp.style.display='block';
  document.getElementById('userAvatar').textContent=getInitials(username);
  document.getElementById('userAvatar').style.background=getAvatarColor(username);
  document.getElementById('userName').textContent=username;
  loadUserData();
  var bc=Object.keys(library).length, wm=document.getElementById('welcomeMsg');
  wm.innerHTML=bc>0?'<h2>Hey, '+escapeHtml(username)+'!</h2><p>'+bc+' book'+(bc>1?'s':'')+' in your library</p>':'<h2>Welcome, '+escapeHtml(username)+'!</h2><p>Upload your first PDF to get started</p>';
  if(bc>0){activeSource='all';showFeedView();}else{resetToUpload();}
}

var uploadArea=document.getElementById('uploadArea'), fileInput=document.getElementById('fileInput');
var fileInputLibrary=document.getElementById('fileInputLibrary'), uploadSection=document.getElementById('uploadSection');
var processing=document.getElementById('processing'), processingTitle=document.getElementById('processingTitle');
var processingSubtitle=document.getElementById('processingSubtitle'), progressFill=document.getElementById('progressFill');
var libraryBar=document.getElementById('libraryBar'), libraryBooks=document.getElementById('libraryBooks');
var addBookBtn=document.getElementById('addBookBtn'), filterBar=document.getElementById('filterBar');
var feed=document.getElementById('feed'), feedGrid=document.getElementById('feedGrid');
var sourceInfo=document.getElementById('sourceInfo'), emptyState=document.getElementById('emptyState');
var smartFilterCheckbox=document.getElementById('smartFilter'), clearDataBtn=document.getElementById('clearDataBtn');
var toast=document.getElementById('toast');

function saveLibrary(){if(!currentUser)return;try{localStorage.setItem('pg_lib_'+currentUser,JSON.stringify(library));}catch(e){}}
function loadUserData(){
  if(!currentUser)return;
  try{library=JSON.parse(localStorage.getItem('pg_lib_'+currentUser)||'{}');}catch(e){library={};}
  try{preferences=JSON.parse(localStorage.getItem('pg_prefs_'+currentUser)||'{}');}catch(e){preferences={};}
  ['likedKeywords','dislikedKeywords','likedCategories','dislikedCategories','likedTypes','dislikedTypes'].forEach(function(k){if(!preferences[k])preferences[k]={};});
  ['likedIds','dislikedIds'].forEach(function(k){if(!preferences[k])preferences[k]=[];});
}
function savePreferences(){if(!currentUser)return;try{localStorage.setItem('pg_prefs_'+currentUser,JSON.stringify(preferences));}catch(e){}}

// ══════════════════════════════════════
//  MEME IMAGE SYSTEM
// ══════════════════════════════════════

var MEME_PHOTOS = {
  funny: [
    'https://picsum.photos/seed/laugh1/480/320',
    'https://picsum.photos/seed/comedy2/480/320',
    'https://picsum.photos/seed/fun3/480/320',
    'https://picsum.photos/seed/party4/480/320',
    'https://picsum.photos/seed/silly5/480/320',
    'https://picsum.photos/seed/joke6/480/320',
    'https://picsum.photos/seed/happy7/480/320',
    'https://picsum.photos/seed/crazy8/480/320',
    'https://picsum.photos/seed/wild9/480/320',
    'https://picsum.photos/seed/chaos10/480/320',
    'https://picsum.photos/seed/face11/480/320',
    'https://picsum.photos/seed/goofy12/480/320',
    'https://picsum.photos/seed/mood13/480/320',
    'https://picsum.photos/seed/vibe14/480/320',
    'https://picsum.photos/seed/lol15/480/320'
  ],
  learning: [
    'https://picsum.photos/seed/book1/480/320',
    'https://picsum.photos/seed/study2/480/320',
    'https://picsum.photos/seed/brain3/480/320',
    'https://picsum.photos/seed/think4/480/320',
    'https://picsum.photos/seed/idea5/480/320',
    'https://picsum.photos/seed/lab6/480/320',
    'https://picsum.photos/seed/explore7/480/320',
    'https://picsum.photos/seed/grow8/480/320',
    'https://picsum.photos/seed/focus9/480/320',
    'https://picsum.photos/seed/mind10/480/320',
    'https://picsum.photos/seed/know11/480/320',
    'https://picsum.photos/seed/spark12/480/320',
    'https://picsum.photos/seed/deep13/480/320',
    'https://picsum.photos/seed/wise14/480/320',
    'https://picsum.photos/seed/nerd15/480/320'
  ],
  information: [
    'https://picsum.photos/seed/news1/480/320',
    'https://picsum.photos/seed/world2/480/320',
    'https://picsum.photos/seed/data3/480/320',
    'https://picsum.photos/seed/globe4/480/320',
    'https://picsum.photos/seed/city5/480/320',
    'https://picsum.photos/seed/report6/480/320',
    'https://picsum.photos/seed/facts7/480/320',
    'https://picsum.photos/seed/info8/480/320',
    'https://picsum.photos/seed/scene9/480/320',
    'https://picsum.photos/seed/view10/480/320',
    'https://picsum.photos/seed/urban11/480/320',
    'https://picsum.photos/seed/nature12/480/320',
    'https://picsum.photos/seed/life13/480/320',
    'https://picsum.photos/seed/real14/480/320',
    'https://picsum.photos/seed/truth15/480/320'
  ]
};

function hashStr(s) {
  var h=0; for(var i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return Math.abs(h);
}

function getPostImage(post) {
  var seed = hashStr(post.id + post.content.substring(0,20));
  var photos = MEME_PHOTOS[post.category] || MEME_PHOTOS.information;
  return photos[seed % photos.length];
}

// ══════════════════════════════════════
//  CONTENT EXTRACTION
// ══════════════════════════════════════

var STOP_WORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','each','every','both','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','that','this','these','those','it','its','they','them','their','he','she','his','her','we','our','you','your','i','me','my','what','which','who','whom','whose','about','also','up','one','two','three','many','much','like','get','got','make','made','take','new','know','see','come','think','look','want','give','use','find','tell','ask','work','seem','feel','try','leave','call','said','went','still','well','back','even','us','way','say','go','going','page','chapter','figure','table','copyright','isbn','publisher','edition','press','printed','reserved','rights','author']);

function extractKeywords(text) {
  return text.toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).filter(function(w){return w.length>3&&!STOP_WORDS.has(w);});
}

var CATEGORY_KEYWORDS = {
  funny: ['joke','humor','laugh','funny','comedy','hilarious','wit','sarcasm','irony','pun','satire','absurd','ridiculous','amusing','fool','silly','nonsense','parody','bizarre','crazy','weird','strange','awkward','embarrass','prank','surprise','unexpected','twist','ironic','comical','clumsy','blunder','mishap','disaster'],
  learning: ['learn','study','research','theory','principle','concept','method','technique','strategy','framework','lesson','education','knowledge','understand','discover','experiment','hypothesis','analysis','insight','skill','practice','develop','improve','growth','teach','science','formula','theorem','definition','rule','process','system','approach','model','evidence','conclusion','observe','measure','explain','demonstrate','brain','psychology','cognitive','behavior','pattern','mechanism','function'],
  information: ['report','data','statistic','fact','news','update','announce','according','survey','percent','million','billion','government','policy','economy','market','industry','company','organization','country','world','global','national','international','official','source','history','event','population','crisis','conflict','agreement','decision','result','impact','change','trend','growth','decline','increase','century','founded','discovered']
};

function categorizeText(text) {
  var lower=text.toLowerCase(), scores={funny:0,learning:0,information:0};
  Object.keys(CATEGORY_KEYWORDS).forEach(function(cat){
    CATEGORY_KEYWORDS[cat].forEach(function(kw){ if(lower.indexOf(kw)!==-1) scores[cat]++; });
  });
  var max=Math.max(scores.funny,scores.learning,scores.information);
  if(max===0) return 'information';
  if(scores.funny>=scores.learning&&scores.funny>=scores.information) return 'funny';
  if(scores.learning>=scores.information) return 'learning';
  return 'information';
}

function classifyPostType(text) {
  if (/\d+\s*%|\b\d{4}\b|million|billion|studies\s+show|research\s+(shows?|found|suggests?)|according\s+to|survey|percent|average|probability|times\s+(more|less|higher|lower)/i.test(text)) return 'fact';
  if (/however|but\s+actually|contrary|surprising|unexpected|most\s+people|common\s+myth|wrong|misconception|turns\s+out|little[\s-]known|you.d\s+think|reality\s+is|in\s+fact|opposite/i.test(text)) return 'surprise';
  if (/should|must|always|never|remember|avoid|try\s+to|make\s+sure|the\s+key|the\s+secret|best\s+way|how\s+to|first\s+step|rule\s+of|don.t|important\s+to|essential|tip/i.test(text)) return 'takeaway';
  if (/means|defined|refers\s+to|is\s+when|concept\s+of|known\s+as|called|theory|principle|in\s+other\s+words|essentially|fundamentally|the\s+term/i.test(text)) return 'keyidea';
  return 'wisdom';
}

var POST_HOOKS = {
  fact: ['Did you know?', 'Fun fact', 'By the numbers', 'True story'],
  surprise: ['Plot twist', 'Think again', 'Wait for it', 'Not what you\'d expect'],
  takeaway: ['Remember this', 'Pro tip', 'Key lesson', 'Note to self'],
  keyidea: ['Big idea', 'Core concept', 'In a nutshell', 'Here\'s the thing'],
  wisdom: ['Think about this', 'Food for thought', 'Perspective shift', 'Let that sink in']
};

function getPostHook(type, seed) {
  var hooks = POST_HOOKS[type] || POST_HOOKS.wisdom;
  return hooks[seed % hooks.length];
}

function standaloneScore(text) {
  var score = 0;
  if (/^(this|that|these|those|it|they|he|she|its|his|her|their|such|the same|the above|as mentioned|as discussed|as noted|as we saw|in this chapter|here we)\b/i.test(text)) score -= 5;
  if (/^(and |but |or |also |however,|moreover|furthermore|additionally|yet |so |thus |therefore|hence|consequently)/i.test(text)) score -= 3;
  if (/\bfigure\s+\d|table\s+\d|chapter\s+\d|section\s+\d|see\s+page|see\s+above|see\s+below|op\.\s*cit|ibid|et\s+al/i.test(text)) score -= 5;
  if (/^(the |a |an |in \d|when |people |most |every |one of|all |many |some |life |time |if you|we all|you |no one|what |according|studies|research|scientists|history|the world|humans|society|the brain|the key|the most|the first|for centuries|throughout|money|success|love|children|women|men|animals)/i.test(text)) score += 2;
  if (/^[A-Z][^?]*[.!]$/.test(text.trim())) score += 1;
  var words = text.split(/\s+/).length;
  if (words >= 8 && words <= 40) score += 1;
  return score;
}

function qualityScore(text) {
  var score = 0, t = text.trim();
  if (t.length >= 40 && t.length <= 250) score += 4;
  else if (t.length >= 30 && t.length <= 350) score += 2;
  else if (t.length < 25 || t.length > 500) return -10;
  if (/^[A-Z]/.test(t)) score += 1;
  if (/[.!?]["”’]?\s*$/.test(t)) score += 2;
  if (/^\d+\s*$|^[A-Z\s,.]{2,}$|copyright|all rights|isbn|acknowledgment|table of contents|bibliography|appendix|index\s*$|^\s*chapter\s+\d|^\s*part\s+(one|two|three|four|i|ii|iii|iv)\b/i.test(t)) return -10;
  if (/\bpage\s+\d|^\s*\d+\s*$|^\s*www\.|^\s*http/i.test(t)) return -10;
  var signal = /important|significant|essential|remarkable|interesting|surprising|powerful|discover|reveal|transform|impact|secret|truth|reality|actually|however|contrary|unexpected|fascinating|extraordinary|crucial|prove|evidence|demonstrate|cause|effect|result|lead to|because|reason|therefore|percent|million|billion|brain|human|world|history|science|study|found that|showed that|suggests that/gi;
  var m = t.match(signal);
  if (m) score += Math.min(m.length * 2, 8);
  return score;
}

function generatePosts(text, sourceTitle, sourceId) {
  var posts = [], seen = new Set();

  var cleaned = text.replace(/\f/g, '\n').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');

  var allSentences = cleaned
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(function(s) { return s.replace(/\s+/g, ' ').trim(); })
    .filter(function(s) { return s.length >= 30 && s.length <= 300; });

  var scored = allSentences.map(function(s) {
    var q = qualityScore(s), st = standaloneScore(s);
    return { text: s, total: q + st, quality: q, standalone: st };
  }).filter(function(x) { return x.quality >= 2 && x.standalone >= 0; });

  var paragraphs = cleaned.split(/\n\s*\n/).filter(function(p) { return p.length > 60 && p.length < 2000; });
  paragraphs.forEach(function(para) {
    var sents = para.replace(/([.!?])\s+/g, '$1\n').split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s.length >= 20; });
    for (var i = 0; i < sents.length - 1; i++) {
      var combined = sents[i] + ' ' + sents[i + 1];
      if (combined.length >= 50 && combined.length <= 300) {
        var q = qualityScore(combined), st = standaloneScore(combined);
        if (q >= 3 && st >= 0) scored.push({ text: combined, total: q + st + 1, quality: q, standalone: st });
      }
    }
  });

  scored.sort(function(a, b) { return b.total - a.total; });

  var maxPosts = Math.min(scored.length, 80);
  for (var i = 0; i < maxPosts; i++) {
    var s = scored[i], key = s.text.substring(0, 50).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    var type = classifyPostType(s.text);
    var hook = getPostHook(type, posts.length);
    var category = categorizeText(s.text);
    var visual = (posts.length % 3 === 0) ? 'gradient' : 'photo';

    posts.push({
      id: sourceId + '-' + posts.length,
      hook: hook,
      content: s.text,
      category: category,
      type: type,
      visual: visual,
      source: sourceTitle,
      sourceId: sourceId
    });
  }

  for (var i = posts.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = posts[i]; posts[i] = posts[j]; posts[j] = t;
  }
  return posts;
}

// ══════════════════════════════════════
//  SMART FEED
// ══════════════════════════════════════

function learnFromAction(post, action) {
  var keywords=extractKeywords(post.content), target=action==='like'?'liked':'disliked';
  var kw=preferences[target+'Keywords'], cat=preferences[target+'Categories'], typ=preferences[target+'Types'];
  keywords.forEach(function(w){kw[w]=(kw[w]||0)+1;});
  cat[post.category]=(cat[post.category]||0)+1;
  typ[post.type]=(typ[post.type]||0)+1;
  if(action==='like'){
    if(preferences.likedIds.indexOf(post.id)===-1) preferences.likedIds.push(post.id);
    preferences.dislikedIds=preferences.dislikedIds.filter(function(id){return id!==post.id;});
  } else {
    if(preferences.dislikedIds.indexOf(post.id)===-1) preferences.dislikedIds.push(post.id);
    preferences.likedIds=preferences.likedIds.filter(function(id){return id!==post.id;});
  }
  savePreferences();
}

function scorePost(post) {
  if(preferences.likedIds.indexOf(post.id)!==-1) return 50;
  if(preferences.dislikedIds.indexOf(post.id)!==-1) return -100;
  var score=0;
  extractKeywords(post.content).forEach(function(w){score+=(preferences.likedKeywords[w]||0);score-=(preferences.dislikedKeywords[w]||0)*2;});
  score+=(preferences.likedCategories[post.category]||0)*2;
  score-=(preferences.dislikedCategories[post.category]||0)*3;
  score+=(preferences.likedTypes[post.type]||0);
  score-=(preferences.dislikedTypes[post.type]||0)*2;
  return score;
}

function shouldHidePost(post) { return preferences.dislikedIds.indexOf(post.id)!==-1; }

// ══════════════════════════════════════
//  EVENT LISTENERS
// ══════════════════════════════════════

uploadArea.addEventListener('click',function(){fileInput.click();});
uploadArea.addEventListener('dragover',function(e){e.preventDefault();uploadArea.classList.add('drag-over');});
uploadArea.addEventListener('dragleave',function(){uploadArea.classList.remove('drag-over');});
uploadArea.addEventListener('drop',function(e){e.preventDefault();uploadArea.classList.remove('drag-over');var f=e.dataTransfer.files[0];if(f&&f.type==='application/pdf')handleFile(f);});
fileInput.addEventListener('change',function(e){if(e.target.files[0])handleFile(e.target.files[0]);e.target.value='';});
fileInputLibrary.addEventListener('change',function(e){if(e.target.files[0])handleFile(e.target.files[0]);e.target.value='';});
addBookBtn.addEventListener('click',function(){fileInputLibrary.click();});
document.getElementById('logoutBtn').addEventListener('click',function(){clearCurrentUser();currentUser=null;library={};preferences={};showLogin();});
smartFilterCheckbox.addEventListener('change',function(){smartMode=smartFilterCheckbox.checked;renderPosts();});
clearDataBtn.addEventListener('click',function(){
  if(confirm('Reset preferences for '+currentUser+'? PDFs stay.')){
    preferences={likedKeywords:{},dislikedKeywords:{},likedCategories:{},dislikedCategories:{},likedTypes:{},dislikedTypes:{},likedIds:[],dislikedIds:[]};
    savePreferences();showToast('Preferences reset');renderPosts();
  }
});
document.querySelectorAll('.chip').forEach(function(chip){
  chip.addEventListener('click',function(){
    document.querySelectorAll('.chip').forEach(function(c){c.classList.remove('active');});
    chip.classList.add('active');currentFilter=chip.dataset.filter;renderPosts();
  });
});

// ══════════════════════════════════════
//  PDF PROCESSING
// ══════════════════════════════════════

function updateProcessing(o){processingTitle.textContent=o.title;processingSubtitle.textContent=o.subtitle;progressFill.style.width=o.progress+'%';}

function extractTextFromPDF(arrayBuffer) {
  if(typeof pdfjsLib==='undefined') return Promise.reject(new Error('PDF library not loaded. Refresh the page.'));
  return pdfjsLib.getDocument({data:arrayBuffer}).promise.then(function(pdf){
    var total=pdf.numPages, fullText='', chain=Promise.resolve();
    for(var i=1;i<=total;i++){(function(pn){chain=chain.then(function(){
      if(pn%10===0||pn===1) updateProcessing({title:'Reading page '+pn+'/'+total,subtitle:Math.round(pn/total*100)+'%',progress:Math.round(pn/total*60)});
      return pdf.getPage(pn).then(function(pg){return pg.getTextContent().then(function(c){fullText+=c.items.map(function(it){return it.str;}).join(' ')+'\n\n';});});
    });})(i);}
    return chain.then(function(){return{text:fullText,numPages:total};});
  });
}

function handleFile(file) {
  uploadSection.hidden=false;uploadArea.hidden=true;processing.hidden=false;
  document.getElementById('welcomeMsg').hidden=true;
  updateProcessing({title:'Reading your PDF...',subtitle:'Loading',progress:5});
  file.arrayBuffer().then(function(buf){
    updateProcessing({title:'Parsing pages...',subtitle:'Extracting text',progress:15});
    return extractTextFromPDF(buf);
  }).then(function(result){
    updateProcessing({title:'Creating posts...',subtitle:'Finding the best content',progress:75});
    var title=file.name.replace(/\.pdf$/i,''), sid='src-'+Date.now();
    var posts=generatePosts(result.text,title,sid);
    library[sid]={name:title,pages:result.numPages,posts:posts,addedAt:Date.now()};
    saveLibrary();
    updateProcessing({title:'Done!',subtitle:posts.length+' posts from '+result.numPages+' pages',progress:100});
    setTimeout(function(){activeSource='all';showFeedView();},800);
  }).catch(function(err){
    console.error(err);processingTitle.textContent='Oops!';
    processingSubtitle.textContent=err.message||'Could not read this PDF.';
    progressFill.style.width='0%';
    setTimeout(function(){processing.hidden=true;uploadArea.hidden=false;document.getElementById('welcomeMsg').hidden=false;},2500);
  });
}

// ══════════════════════════════════════
//  LIBRARY & FEED
// ══════════════════════════════════════

function renderLibrary() {
  libraryBooks.innerHTML='';
  var sources=Object.entries(library).sort(function(a,b){return b[1].addedAt-a[1].addedAt;});
  if(!sources.length){libraryBar.hidden=true;return;}
  libraryBar.hidden=false;
  var allPill=document.createElement('button');allPill.className='book-pill book-pill-all'+(activeSource==='all'?' active':'');
  var total=sources.reduce(function(s,e){return s+e[1].posts.length;},0);
  allPill.innerHTML='All <span class="book-count">('+total+')</span>';
  allPill.addEventListener('click',function(){activeSource='all';showFeedView();});
  libraryBooks.appendChild(allPill);
  sources.forEach(function(entry){
    var id=entry[0],src=entry[1],pill=document.createElement('button');
    pill.className='book-pill'+(activeSource===id?' active':'');
    pill.innerHTML=escapeHtml(src.name)+' <span class="book-count">('+src.posts.length+')</span><span class="book-remove" data-id="'+id+'">&times;</span>';
    pill.addEventListener('click',function(e){if(e.target.classList.contains('book-remove'))return;activeSource=id;showFeedView();});
    pill.querySelector('.book-remove').addEventListener('click',function(e){e.stopPropagation();if(confirm('Remove "'+src.name+'"?')){delete library[id];saveLibrary();if(activeSource===id)activeSource='all';if(!Object.keys(library).length){resetToUpload();return;}showFeedView();}});
    libraryBooks.appendChild(pill);
  });
}

function getAllPosts() {
  if(activeSource==='all'){var all=[];Object.keys(library).forEach(function(k){all=all.concat(library[k].posts);});return all;}
  return library[activeSource]?library[activeSource].posts:[];
}

function showFeedView(){uploadSection.hidden=true;filterBar.hidden=false;feed.hidden=false;libraryBar.hidden=false;renderLibrary();updateSourceInfo();renderPosts();}

function updateSourceInfo() {
  var posts=getAllPosts(), counts={funny:0,learning:0,information:0};
  posts.forEach(function(p){counts[p.category]++;});
  var liked=preferences.likedIds.filter(function(id){return posts.some(function(p){return p.id===id;});}).length;
  var srcName=activeSource==='all'?'All Books':(library[activeSource]?library[activeSource].name:'');
  var pages=activeSource==='all'?Object.values(library).reduce(function(s,src){return s+src.pages;},0):(library[activeSource]?library[activeSource].pages:0);
  sourceInfo.innerHTML='<strong>'+escapeHtml(srcName)+'</strong> &middot; '+pages+' pg &middot; '+posts.length+' posts &nbsp;|&nbsp; <span style="color:#ef4444">&#128516; '+counts.funny+'</span> &middot; <span style="color:#8b5cf6">&#129504; '+counts.learning+'</span> &middot; <span style="color:#3b82f6">&#128240; '+counts.information+'</span>'+(liked>0?' &middot; <span style="color:#22c55e">&#10084;&#65039; '+liked+'</span>':'');
}

function resetToUpload(){
  currentFilter='all';activeSource='all';fileInput.value='';
  uploadSection.hidden=false;uploadArea.hidden=false;processing.hidden=true;filterBar.hidden=true;
  feed.hidden=true;emptyState.hidden=true;libraryBar.hidden=true;feedGrid.innerHTML='';
  document.getElementById('welcomeMsg').hidden=false;
  document.querySelectorAll('.chip').forEach(function(c){c.classList.remove('active');});
  document.querySelector('[data-filter="all"]').classList.add('active');
}

function renderPosts() {
  feedGrid.innerHTML='';
  var posts=getAllPosts();
  if(currentFilter==='liked') posts=posts.filter(function(p){return preferences.likedIds.indexOf(p.id)!==-1;});
  else if(currentFilter!=='all') posts=posts.filter(function(p){return p.category===currentFilter;});
  if(smartMode) posts=posts.filter(function(p){return !shouldHidePost(p);});

  var likedPosts=[], scoredPosts=[], restPosts=[];
  posts.forEach(function(p){
    var s=scorePost(p);
    if(preferences.likedIds.indexOf(p.id)!==-1) likedPosts.push(p);
    else if(s>3) scoredPosts.push({post:p,score:s});
    else restPosts.push(p);
  });
  scoredPosts.sort(function(a,b){return b.score-a.score;});
  for(var i=restPosts.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=restPosts[i];restPosts[i]=restPosts[j];restPosts[j]=tmp;}
  var final=likedPosts.concat(scoredPosts.map(function(x){return x.post;})).concat(restPosts);

  if(!final.length){emptyState.hidden=false;feed.hidden=true;return;}
  emptyState.hidden=true;feed.hidden=false;
  final.forEach(function(post,i){feedGrid.appendChild(createPostCard(post,i));});
}

// ══════════════════════════════════════
//  INSTAGRAM-STYLE POST CARD
// ══════════════════════════════════════

function highlightText(text) {
  var html = escapeHtml(text);
  html = html.replace(/(\d[\d,\.]*\s*%)/g, '<strong>$1</strong>');
  html = html.replace(/(\b\d[\d,\.]+\s*(million|billion|thousand|trillion|years|century|centuries|times))/gi, '<strong>$1</strong>');
  return html;
}

function createPostCard(post, index) {
  var card = document.createElement('article');
  card.className = 'post-card';
  card.dataset.category = post.category;
  card.dataset.type = post.type || 'wisdom';
  card.dataset.id = post.id;
  card.style.animationDelay = Math.min(index * 0.05, 0.6) + 's';

  var isLiked = preferences.likedIds.indexOf(post.id) !== -1;
  var isDisliked = preferences.dislikedIds.indexOf(post.id) !== -1;
  var score = scorePost(post);
  var hook = post.hook || '';
  var visual = post.visual || 'photo';

  var typeEmoji = {fact:'&#129327;',surprise:'&#128293;',takeaway:'&#128204;',keyidea:'&#128161;',wisdom:'&#10024;'};
  var typeLabel = {fact:'DID YOU KNOW',surprise:'PLOT TWIST',takeaway:'KEY TAKEAWAY',keyidea:'BIG IDEA',wisdom:'THINK ABOUT THIS'};
  var catEmoji = {funny:'&#128514;',learning:'&#129504;',information:'&#128240;'};
  var catLabel = {funny:'Funny',learning:'Learning',information:'Info'};

  var contentHtml = highlightText(post.content);
  var html = '';

  if (visual === 'gradient') {
    html =
      '<div class="card-visual card-gradient-bg">' +
        '<div class="card-type-badge">' + (typeEmoji[post.type]||'&#10024;') + ' ' + (typeLabel[post.type]||'INSIGHT') + '</div>' +
        '<div class="card-text-area">' +
          (hook ? '<p class="card-hook">' + escapeHtml(hook) + '</p>' : '') +
          '<p class="card-main-text">' + contentHtml + '</p>' +
        '</div>' +
        '<div class="card-info-bar">' +
          '<span class="card-tag">&#128218; ' + escapeHtml(post.source) + '</span>' +
          '<span class="card-tag">' + (catEmoji[post.category]||'') + ' ' + (catLabel[post.category]||'') + '</span>' +
        '</div>' +
        (score > 5 && !isLiked ? '<div class="score-badge high">&#9733; For you</div>' : '') +
      '</div>';
  } else {
    var imgUrl = getPostImage(post);
    html =
      '<div class="card-visual card-photo">' +
        '<img src="' + imgUrl + '" alt="" loading="lazy" onerror="this.parentElement.classList.add(\'img-failed\')">' +
        '<div class="card-overlay">' +
          '<div class="card-type-badge">' + (typeEmoji[post.type]||'&#10024;') + ' ' + (typeLabel[post.type]||'INSIGHT') + '</div>' +
          '<div class="card-text-area">' +
            (hook ? '<p class="card-hook">' + escapeHtml(hook) + '</p>' : '') +
            '<p class="card-main-text">' + contentHtml + '</p>' +
          '</div>' +
          '<div class="card-info-bar">' +
            '<span class="card-tag">&#128218; ' + escapeHtml(post.source) + '</span>' +
            '<span class="card-tag">' + (catEmoji[post.category]||'') + ' ' + (catLabel[post.category]||'') + '</span>' +
          '</div>' +
        '</div>' +
        (score > 5 && !isLiked ? '<div class="score-badge high">&#9733; For you</div>' : '') +
      '</div>';
  }

  html +=
    '<div class="card-actions-bar">' +
      '<button class="action-btn like-action' + (isLiked?' liked':'') + '"><svg width="22" height="22" viewBox="0 0 24 24" fill="' + (isLiked?'currentColor':'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>' +
      '<button class="action-btn dislike-action' + (isDisliked?' disliked':'') + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '<span class="card-action-source">&#128218; ' + escapeHtml(post.source) + '</span>' +
      '<button class="action-btn copy-action"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
    '</div>';

  card.innerHTML = html;

  card.querySelector('.like-action').addEventListener('click', function() {
    var btn = this;
    if (preferences.likedIds.indexOf(post.id) !== -1) {
      preferences.likedIds = preferences.likedIds.filter(function(id){return id!==post.id;});
      btn.classList.remove('liked'); btn.querySelector('svg').setAttribute('fill','none');
      showToast('Removed from liked');
    } else {
      learnFromAction(post, 'like');
      btn.classList.add('liked'); btn.querySelector('svg').setAttribute('fill','currentColor');
      card.querySelector('.dislike-action').classList.remove('disliked');
      animateButton(btn); showToast('Liked! More like this');
    }
    savePreferences(); updateSourceInfo();
  });

  card.querySelector('.dislike-action').addEventListener('click', function() {
    learnFromAction(post, 'dislike');
    card.classList.add('removing');
    showToast('Got it. Less like this');
    setTimeout(function(){card.remove();updateSourceInfo();}, 400);
  });

  card.querySelector('.copy-action').addEventListener('click', function() {
    var btn = this;
    navigator.clipboard.writeText(post.content).then(function(){
      btn.style.color='#22c55e'; setTimeout(function(){btn.style.color='';},1000);
      showToast('Copied!');
    });
  });

  return card;
}

// ── Helpers ──
var toastTimer;
function showToast(msg){toast.textContent=msg;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){toast.hidden=true;},2000);}
function animateButton(btn){btn.style.transform='scale(1.3)';setTimeout(function(){btn.style.transform='scale(1)';},200);}
function escapeHtml(str){var d=document.createElement('div');d.textContent=str;return d.innerHTML;}

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
var savedUser = getCurrentUser();
if (savedUser && userExists(savedUser)) enterApp(savedUser);
else { clearCurrentUser(); showLogin(); }
