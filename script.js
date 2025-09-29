// Detect browser language for Wikipedia domain
const userLang = navigator.language || navigator.userLanguage;
const wikiLang = userLang.startsWith('hi') ? 'hi' : 'en';
const apiBase = `https://${wikiLang}.wikipedia.org/w/api.php`;

// DOM elements
const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('suggestions');
const articleContent = document.getElementById('article-content');
const relatedCards = document.getElementById('related-cards');

// --- New: Load Recent/Trending Topic on page load ---
async function loadRecentTopic() {
  const url = new URL(apiBase);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('list', 'mostviewed');
  url.searchParams.set('pvimlimit', '10'); // top 10 trending topics

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.query && data.query.mostviewed && data.query.mostviewed.length > 0) {
      // Pick first topic (or random one)
      const topics = data.query.mostviewed.filter(p => p.ns === 0); // only articles
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];
      if (randomTopic && randomTopic.title) {
        loadArticle(randomTopic.title);
      }
    }
  } catch (err) {
    console.error("Error fetching recent topic:", err);
    articleContent.innerHTML = "<p>Unable to load recent topic.</p>";
  }
}

// --- Search Suggestions ---
let timeoutId;
searchInput.addEventListener('input', () => {
  clearTimeout(timeoutId);
  const query = searchInput.value.trim();
  if (query.length < 2) {
    suggestionsList.innerHTML = '';
    return;
  }
  timeoutId = setTimeout(() => { fetchSuggestions(query); }, 300);
});

async function fetchSuggestions(query) {
  const url = new URL(apiBase);
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('generator', 'prefixsearch');
  url.searchParams.set('gpssearch', query);
  url.searchParams.set('gpslimit', '8');
  url.searchParams.set('gpsnamespace', '0');
  url.searchParams.set('prop', 'pageimages');
  url.searchParams.set('piprop', 'thumbnail');
  url.searchParams.set('pithumbsize', '80');
  url.searchParams.set('pilimit', '8');
  try {
    const res = await fetch(url);
    const data = await res.json();
    displaySuggestions(data.query ? data.query.pages : []);
  } catch (err) {
    console.error('Suggestion fetch error:', err);
  }
}

function displaySuggestions(pages) {
  suggestionsList.innerHTML = '';
  if (!pages) return;
  const results = Object.values(pages).sort((a, b) => (a.index || 0) - (b.index || 0));
  results.forEach(page => {
    const li = document.createElement('li');
    if (page.thumbnail && page.thumbnail.source) {
      const img = document.createElement('img');
      img.src = page.thumbnail.source;
      li.appendChild(img);
    }
    const span = document.createElement('span');
    span.textContent = page.title;
    li.appendChild(span);
    li.addEventListener('click', () => {
      searchInput.value = page.title;
      suggestionsList.innerHTML = '';
      loadArticle(page.title);
    });
    suggestionsList.appendChild(li);
  });
}

// --- Load Article ---
async function loadArticle(title) {
  articleContent.innerHTML = '<p>Loading...</p>';
  relatedCards.innerHTML = '';
  const url = new URL(apiBase);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', title);
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  url.searchParams.set('prop', 'text');
  url.searchParams.set('formatversion', '2');
  url.searchParams.set('disableeditsection', 'true');
  url.searchParams.set('disabletoc', 'true');
  try {
    const res = await fetch(url);
    const data = await res.json();
    const html = data.parse.text;
    displayArticle(html, title);
  } catch (err) {
    articleContent.innerHTML = `<p>Error loading article.</p>`;
    console.error('Article fetch error:', err);
  }
}

function displayArticle(html, title) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  tempDiv.querySelectorAll('sup.reference').forEach(el => el.remove());
  tempDiv.querySelectorAll('.mw-editsection').forEach(el => el.remove());
  tempDiv.querySelectorAll('.toc').forEach(el => el.remove());
  tempDiv.querySelectorAll('.infobox').forEach(el => el.remove());
  tempDiv.querySelectorAll('.thumb').forEach(el => el.remove());
  tempDiv.querySelectorAll('.navbox').forEach(el => el.remove());
  const refHeadline = Array.from(tempDiv.querySelectorAll('h2, h3')).find(h => 
    h.textContent.toLowerCase().includes('references'));
  if (refHeadline) {
    refHeadline.remove();
    let sib = refHeadline.nextElementSibling;
    while (sib && !['H1','H2','H3','H4','H5','H6'].includes(sib.tagName)) {
      const next = sib.nextElementSibling;
      sib.remove();
      sib = next;
    }
  }
  articleContent.innerHTML = '';
  Array.from(tempDiv.children).forEach(node => {
    articleContent.appendChild(node.cloneNode(true));
  });
  const viewLink = document.createElement('p');
  viewLink.className = 'view-original';
  viewLink.innerHTML = `🔗 <a href="https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(title)}" target="_blank">View Original Content</a>`;
  articleContent.appendChild(viewLink);

  const links = Array.from(articleContent.querySelectorAll('a'));
  const seen = new Set();
  let count = 0;
  links.forEach(a => {
    const href = a.getAttribute('href') || '';
    if (count >= 5) return;
    if (href.startsWith(`/wiki/`) && !href.includes(':')) {
      const linkedTitle = a.textContent.trim();
      if (linkedTitle && !seen.has(linkedTitle) && linkedTitle.toLowerCase() !== title.toLowerCase()) {
        seen.add(linkedTitle);
        const card = document.createElement('div');
        card.className = 'card';
        card.textContent = linkedTitle;
        card.addEventListener('click', () => {
          loadArticle(linkedTitle);
        });
        relatedCards.appendChild(card);
        count++;
      }
    }
  });
}

// --- Init: load recent trending topic on page load ---
window.addEventListener('DOMContentLoaded', loadRecentTopic);
