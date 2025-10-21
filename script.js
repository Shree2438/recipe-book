/* Recipe Book - Basic functionality
   - Stores recipes in localStorage under key "recipes"
   - Supports add/view/search/filter/favorites + dark mode
*/

const LS_KEY = "recipes_v1";

// DOM elements
const recipesSection = document.getElementById('recipesSection');
const emptyHint = document.getElementById('emptyHint');
const addModal = document.getElementById('addModal');
const viewModal = document.getElementById('viewModal');
const recipeForm = document.getElementById('recipeForm');
const addRecipeBtn = document.getElementById('addRecipeBtn');
const closeAddModal = document.getElementById('closeAddModal');
const cancelAdd = document.getElementById('cancelAdd');
const viewContent = document.getElementById('viewContent');
const closeViewModal = document.getElementById('closeViewModal');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const favoritesBtn = document.getElementById('favoritesBtn');
const darkToggle = document.getElementById('darkToggle');

let recipes = loadRecipes();
let showingFavorites = false;

// --- Storage helpers ---
function loadRecipes() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load recipes", e);
    return [];
  }
}
function saveRecipes() {
  localStorage.setItem(LS_KEY, JSON.stringify(recipes));
}

// --- Render ---
function renderRecipes(list = recipes) {
  recipesSection.innerHTML = "";
  if (!list.length) {
    emptyHint.style.display = 'block';
    return;
  }
  emptyHint.style.display = 'none';
  list.forEach(r => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <img src="${r.image || placeholderImage(r.title)}" alt="${escapeHtml(r.title)}" />
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(r.title)}</h3>
        <div class="card-meta">
          <div class="tag">${escapeHtml(r.category || 'Uncategorized')}</div>
          <div style="flex:1"></div>
          <small class="card-count">${r.ingredients.length} ingredients</small>
        </div>
        <div class="card-actions">
          <div>
            <button class="icon-btn small view-btn" data-id="${r.id}">View</button>
            <button class="icon-btn small" data-id="${r.id}" data-action="copy">Copy</button>
          </div>
          <div>
            <button class="icon-btn small fav-btn" data-id="${r.id}">${r.favorite ? '💖' : '🤍'}</button>
          </div>
        </div>
      </div>
    `;
    // View
    card.querySelector('.view-btn').addEventListener('click', () => openViewModal(r.id));
    // Copy (copy ingredients to clipboard)
    card.querySelector('[data-action="copy"]').addEventListener('click', () => {
      navigator.clipboard?.writeText(r.ingredients.join('\n')).then(()=> alert('Ingredients copied to clipboard'));
    });
    // Favorite toggler
    card.querySelector('.fav-btn').addEventListener('click', (e) => {
      toggleFavorite(r.id);
    });

    recipesSection.appendChild(card);
  });
}

// Escape for safety (basic)
function escapeHtml(s){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }

// Placeholder if no image
function placeholderImage(title){
  // simple data-URL with SVG
  const svg = encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='600' height='360'><rect width='100%' height='100%' fill='#f2efe8'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Poppins, sans-serif' font-size='28' fill='#8b5a2b'>${title}</text></svg>`);
  return `data:image/svg+xml;charset=utf-8,${svg}`;
}

// --- Modals and forms ---
addRecipeBtn.addEventListener('click', () => {
  addModal.classList.remove('hidden');
});
closeAddModal.addEventListener('click', () => addModal.classList.add('hidden'));
cancelAdd.addEventListener('click', () => addModal.classList.add('hidden'));

closeViewModal.addEventListener('click', () => viewModal.classList.add('hidden'));

// Handle new recipe submit
recipeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(recipeForm);
  const title = (fd.get('title') || "").trim();
  const category = (fd.get('category') || "").trim();
  const ingredients = (fd.get('ingredients') || "").toString().split('\n').map(s=>s.trim()).filter(Boolean);
  const steps = (fd.get('steps') || "").toString().split('\n').map(s=>s.trim()).filter(Boolean);
  const file = fd.get('image');

  // Validate
  if (!title || !ingredients.length || !steps.length) {
    alert('Please fill in title, ingredients, and steps.');
    return;
  }

  let imageData = '';
  if (file && file.size) {
    imageData = await toBase64(file);
  }

  const newRecipe = {
    id: Date.now().toString(),
    title, category, ingredients, steps, image: imageData,
    favorite: false,
    created: new Date().toISOString()
  };
  recipes.unshift(newRecipe);
  saveRecipes();
  renderFiltered();
  recipeForm.reset();
  addModal.classList.add('hidden');
});

// convert file -> base64
function toBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// View recipe
function openViewModal(id){
  const r = recipes.find(x=>x.id===id);
  if (!r) return;
  viewContent.innerHTML = `
    <h2 style="font-family:Playfair Display">${escapeHtml(r.title)}</h2>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div class="tag">${escapeHtml(r.category||'Uncategorized')}</div>
      <div style="color:var(--muted);font-size:13px">Added: ${new Date(r.created).toLocaleString()}</div>
    </div>
    ${r.image ? `<img src="${r.image}" alt="${escapeHtml(r.title)}">` : ''}
    <h4>Ingredients</h4>
    <ul class="ingredients">${r.ingredients.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ul>
    <h4>Steps</h4>
    <ol class="steps">${r.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol>
  `;
  viewModal.classList.remove('hidden');
}

// favorites
function toggleFavorite(id){
  const idx = recipes.findIndex(x=>x.id===id);
  if (idx<0) return;
  recipes[idx].favorite = !recipes[idx].favorite;
  saveRecipes();
  renderFiltered();
}

// --- Search and filter ---
function renderFiltered(){
  let list = [...recipes];
  // if favorites view enabled
  if (showingFavorites) list = list.filter(r=>r.favorite);
  // category
  const cat = categoryFilter.value;
  if (cat && cat !== 'all') list = list.filter(r=>r.category===cat);
  // search
  const q = searchInput.value.trim().toLowerCase();
  if (q) {
    list = list.filter(r=>{
      return r.title.toLowerCase().includes(q)
        || r.ingredients.join(' ').toLowerCase().includes(q)
        || (r.category||'').toLowerCase().includes(q);
    });
  }
  renderRecipes(list);
}

// wiring search + filter events
searchInput.addEventListener('input', debounce(renderFiltered, 220));
categoryFilter.addEventListener('change', renderFiltered);

// favorites btn
favoritesBtn.addEventListener('click', () => {
  showingFavorites = !showingFavorites;
  favoritesBtn.textContent = showingFavorites ? '❤️ Viewing Favorites' : '❤️ Favorites';
  renderFiltered();
});

// initial render
renderFiltered();

// --- Dark mode ---
function applyDarkClass(enabled){
  if (enabled) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}
darkToggle.addEventListener('click', () => {
  const enabled = !document.documentElement.classList.contains('dark');
  applyDarkClass(enabled);
  localStorage.setItem('dark_mode', enabled ? '1' : '0');
});
// restore dark
if (localStorage.getItem('dark_mode') === '1') applyDarkClass(true);

// --- Utilities ---
function debounce(fn, wait){
  let t;
  return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), wait); };
}
