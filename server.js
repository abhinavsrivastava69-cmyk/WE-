const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

const CATEGORY_KEYWORDS = {
  funny: [
    'joke', 'humor', 'laugh', 'funny', 'comedy', 'hilarious', 'wit',
    'sarcasm', 'irony', 'pun', 'satire', 'absurd', 'ridiculous',
    'amusing', 'comical', 'giggle', 'chuckle', 'fool', 'silly',
    'nonsense', 'parody', 'mock', 'haha', 'lol', 'rofl'
  ],
  learning: [
    'learn', 'study', 'research', 'theory', 'principle', 'concept',
    'method', 'technique', 'strategy', 'framework', 'approach',
    'lesson', 'education', 'knowledge', 'understand', 'discover',
    'experiment', 'hypothesis', 'analysis', 'insight', 'skill',
    'practice', 'master', 'develop', 'improve', 'growth', 'teach',
    'science', 'mathematical', 'formula', 'equation', 'theorem',
    'chapter', 'exercise', 'definition', 'rule', 'step'
  ],
  information: [
    'report', 'data', 'statistic', 'fact', 'news', 'update',
    'announce', 'according', 'survey', 'percent', 'million',
    'billion', 'government', 'policy', 'economy', 'market',
    'industry', 'company', 'organization', 'country', 'world',
    'global', 'national', 'international', 'official', 'source',
    'history', 'event', 'date', 'year', 'century', 'population'
  ]
};

function categorizeText(text) {
  const lower = text.toLowerCase();
  const scores = { funny: 0, learning: 0, information: 0 };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) scores[category] += matches.length;
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'information';

  return Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a, ['information', 0])[0];
}

function extractQuotes(text) {
  const quotes = [];
  const quotePatterns = [
    /[""“]([^""”]{20,200})[""”]/g,
    /[''‘]([^''’]{20,200})[''’]/g,
  ];
  for (const pattern of quotePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      quotes.push(match[1].trim());
    }
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

  // Extract standalone quotes
  const quotes = extractQuotes(text);
  for (const quote of quotes.slice(0, 15)) {
    const key = quote.substring(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);
    posts.push({
      id: `post-${posts.length}`,
      content: quote,
      category: categorizeText(quote),
      type: 'quote',
      source: sourceTitle,
      timestamp: new Date().toISOString()
    });
  }

  // Extract key paragraphs as insights
  for (const para of paragraphs) {
    if (posts.length >= 60) break;
    const key = para.substring(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);

    const sentences = splitIntoSentences(para);
    const bestSentences = sentences
      .sort((a, b) => {
        const scoreA = (a.match(/\b(important|key|significant|essential|crucial|remarkable|notable|interesting|surprising|powerful)\b/gi) || []).length;
        const scoreB = (b.match(/\b(important|key|significant|essential|crucial|remarkable|notable|interesting|surprising|powerful)\b/gi) || []).length;
        return scoreB - scoreA;
      })
      .slice(0, 3);

    if (bestSentences.length === 0) continue;

    const content = bestSentences.join(' ');
    if (content.length < 40 || content.length > 600) continue;

    posts.push({
      id: `post-${posts.length}`,
      content,
      category: categorizeText(content),
      type: 'insight',
      source: sourceTitle,
      timestamp: new Date().toISOString()
    });
  }

  // Extract numbered lists, bullet points as tips
  const listItems = text.match(/(?:^|\n)\s*(?:\d+[.)]\s|[-•*]\s)(.{20,300})/g) || [];
  for (const item of listItems.slice(0, 15)) {
    if (posts.length >= 80) break;
    const cleaned = item.replace(/^\s*(?:\d+[.)]\s|[-•*]\s)/, '').trim();
    const key = cleaned.substring(0, 50);
    if (seen.has(key)) continue;
    seen.add(key);

    posts.push({
      id: `post-${posts.length}`,
      content: cleaned,
      category: categorizeText(cleaned),
      type: 'tip',
      source: sourceTitle,
      timestamp: new Date().toISOString()
    });
  }

  // Shuffle for variety
  for (let i = posts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [posts[i], posts[j]] = [posts[j], posts[i]];
  }

  return posts;
}

app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    const data = await pdfParse(req.file.buffer);
    const sourceTitle = req.file.originalname.replace(/\.pdf$/i, '');
    const posts = generatePosts(data.text, sourceTitle);

    res.json({
      success: true,
      source: sourceTitle,
      totalPages: data.numpages,
      totalPosts: posts.length,
      posts
    });
  } catch (err) {
    console.error('PDF processing error:', err);
    res.status(500).json({ error: 'Failed to process PDF. Please try again.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
