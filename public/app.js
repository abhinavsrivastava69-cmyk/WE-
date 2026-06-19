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

// Upload area interactions
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

newUploadBtn.addEventListener('click', () => {
  resetToUpload();
});

// Filter chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderPosts();
  });
});

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

async function handleFile(file) {
  uploadArea.hidden = true;
  processing.hidden = false;

  const messages = [
    { title: 'Reading your PDF...', subtitle: 'Extracting the good stuff', progress: 20 },
    { title: 'Analyzing content...', subtitle: 'Finding the highlights', progress: 50 },
    { title: 'Generating posts...', subtitle: 'Almost there!', progress: 80 },
  ];

  let msgIdx = 0;
  updateProcessing(messages[0]);

  const msgInterval = setInterval(() => {
    msgIdx++;
    if (msgIdx < messages.length) {
      updateProcessing(messages[msgIdx]);
    }
  }, 1500);

  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    clearInterval(msgInterval);

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }

    const data = await res.json();
    progressFill.style.width = '100%';
    processingTitle.textContent = 'Done!';
    processingSubtitle.textContent = `Generated ${data.totalPosts} posts from ${data.totalPages} pages`;

    allPosts = data.posts;

    setTimeout(() => {
      showFeed(data.source, data.totalPages, data.totalPosts);
    }, 800);

  } catch (err) {
    clearInterval(msgInterval);
    processingTitle.textContent = 'Oops!';
    processingSubtitle.textContent = err.message;
    progressFill.style.width = '0%';
    setTimeout(resetToUpload, 2500);
  }
}

function updateProcessing({ title, subtitle, progress }) {
  processingTitle.textContent = title;
  processingSubtitle.textContent = subtitle;
  progressFill.style.width = progress + '%';
}

function showFeed(source, pages, postCount) {
  uploadSection.hidden = true;
  filterBar.hidden = false;
  feed.hidden = false;

  const counts = { funny: 0, learning: 0, information: 0 };
  allPosts.forEach(p => counts[p.category]++);

  sourceInfo.innerHTML = `
    <strong>${source}</strong> &middot; ${pages} pages &middot; ${postCount} posts
    &nbsp;|&nbsp;
    <span style="color:#ef4444">😄 ${counts.funny}</span> &middot;
    <span style="color:#8b5cf6">🧠 ${counts.learning}</span> &middot;
    <span style="color:#3b82f6">📰 ${counts.information}</span>
  `;

  renderPosts();
}

function renderPosts() {
  feedGrid.innerHTML = '';

  const filtered = currentFilter === 'all'
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
    const card = createPostCard(post, index);
    feedGrid.appendChild(card);
  });
}

function createPostCard(post, index) {
  const card = document.createElement('article');
  card.className = 'post-card';
  card.dataset.category = post.category;
  card.dataset.type = post.type;
  card.style.animationDelay = `${Math.min(index * 0.08, 1)}s`;

  const categoryEmojis = {
    funny: '😄',
    learning: '🧠',
    information: '📰'
  };

  const typeLabels = {
    quote: '💬 Quote',
    insight: '💡 Insight',
    tip: '📌 Tip'
  };

  card.innerHTML = `
    <div class="post-card-header">
      <div class="post-gradient-bar"></div>
    </div>
    <div class="post-meta">
      <span class="post-category-badge">
        ${categoryEmojis[post.category]} ${post.category}
      </span>
      <span class="post-type-badge">${typeLabels[post.type] || post.type}</span>
    </div>
    <div class="post-content">${escapeHtml(post.content)}</div>
    <div class="post-footer">
      <span class="post-source">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        ${escapeHtml(post.source)}
      </span>
      <div class="post-actions">
        <button class="action-btn like-btn ${likedPosts.has(post.id) ? 'liked' : ''}" title="Like" data-id="${post.id}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${likedPosts.has(post.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
        <button class="action-btn bookmark-btn ${bookmarkedPosts.has(post.id) ? 'bookmarked' : ''}" title="Save" data-id="${post.id}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${bookmarkedPosts.has(post.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button class="action-btn copy-btn" title="Copy text" data-content="${encodeURIComponent(post.content)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Event listeners
  const likeBtn = card.querySelector('.like-btn');
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

  const bookmarkBtn = card.querySelector('.bookmark-btn');
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

  const copyBtn = card.querySelector('.copy-btn');
  copyBtn.addEventListener('click', () => {
    const text = decodeURIComponent(copyBtn.dataset.content);
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.style.color = '#10b981';
      setTimeout(() => {
        copyBtn.style.color = '';
      }, 1000);
    });
  });

  return card;
}

function animateButton(btn) {
  btn.style.transform = 'scale(1.3)';
  setTimeout(() => {
    btn.style.transform = 'scale(1)';
  }, 200);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
