// script.js
//
// Responsibilities:
//   1. Load products.json
//   2. Build the category pills from whatever categories exist in the data
//   3. Render product cards into the grid
//   4. Re-render whenever the search text or selected category changes
//
// Keeping data (products.json) separate from this file means: adding a
// 9th product later means editing JSON only — never touching this logic.

let allProducts = [];       // full list, loaded once from products.json
let activeCategory = "All"; // which pill is currently selected
let searchTerm = "";        // current text in the search box

const gridEl = document.getElementById("product-grid");
const pillsEl = document.getElementById("category-pills");
const searchInputEl = document.getElementById("search-input");
const emptyStateEl = document.getElementById("empty-state");

init();

async function init() {
  try {
    const response = await fetch("products.json");
    allProducts = await response.json();
  } catch (err) {
    // If products.json fails to load (e.g. opened as a raw file:// page
    // without a local server — see README), show a clear message instead
    // of a silently empty page.
    gridEl.innerHTML =
      "<p>Couldn't load products.json. If you're opening this file directly in a browser, run a local server instead (see README).</p>";
    console.error(err);
    return;
  }

  buildCategoryPills();
  render();

  searchInputEl.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    render();
  });
}

// Builds one pill per unique category found in the data, plus an "All"
// pill at the start. Using a Set here is just the standard JS way to get
// unique values out of an array.
function buildCategoryPills() {
  const categories = ["All", ...new Set(allProducts.map((p) => p.category))];

  pillsEl.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pill" + (category === activeCategory ? " active" : "");
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      // Move the "active" class to whichever pill was just clicked.
      pillsEl.querySelectorAll(".pill").forEach((pill) => pill.classList.remove("active"));
      button.classList.add("active");
      render();
    });
    pillsEl.appendChild(button);
  });
}

// Applies the current search text + category filter, then redraws the grid.
// Both filters are combined with AND: a product must match the selected
// category AND contain the search text in its name.
function render() {
  const filtered = allProducts.filter((product) => {
    const matchesCategory = activeCategory === "All" || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  gridEl.innerHTML = "";
  emptyStateEl.hidden = filtered.length > 0;

  filtered.forEach((product) => {
    gridEl.appendChild(buildProductCard(product));
  });
}

// Builds a single <article class="product-card"> element via the DOM API
// (rather than innerHTML + string concatenation) so product names never
// have to be manually escaped — textContent always inserts plain text
// safely, even if a name later contains characters like < or &.
function buildProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "product-image-wrap";

  if (product.badge) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = product.badge;
    imageWrap.appendChild(badge);
  }

  const image = document.createElement("img");
  image.src = product.image;
  image.alt = product.name;
  image.loading = "lazy";
  imageWrap.appendChild(image);

  const body = document.createElement("div");
  body.className = "product-body";

  const category = document.createElement("p");
  category.className = "product-category";
  category.textContent = product.category;

  const name = document.createElement("h2");
  name.className = "product-name";
  name.textContent = product.name;

  body.appendChild(category);
  body.appendChild(name);

  // Price is optional per the data model, so only render it when present.
  if (product.price) {
    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = product.price;
    body.appendChild(price);
  }

  const cta = document.createElement("a");
  cta.className = "product-cta";
  cta.href = product.link;
  cta.textContent = "Get it →";
  cta.target = "_blank";        // opens in a new tab
  cta.rel = "noopener noreferrer"; // security best practice for target="_blank" links:
                                    // stops the opened page from accessing window.opener
  body.appendChild(cta);

  card.appendChild(imageWrap);
  card.appendChild(body);
  return card;
}
