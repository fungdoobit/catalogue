# Picked & Packed

A small, static, Apple-style curated product link page. Plain HTML/CSS/JS —
no build step, no frameworks, no backend.

## Files

- `index.html` — page structure
- `styles.css` — all styling
- `script.js` — loads `products.json` and handles search + category filtering
- `products.json` — the product data (edit this to add/change products)

## Preview locally

Because `script.js` uses `fetch()` to load `products.json`, opening
`index.html` directly by double-clicking it won't work in most browsers
(they block `fetch` on the `file://` protocol). Run a tiny local server
instead — no install needed if you have Python:

```bash
cd catalogue
python3 -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

(No Python? VS Code's "Live Server" extension does the same thing with one click.)

## Deploy for free with GitHub Pages

1. Push this repo to GitHub (if it isn't already).
2. On GitHub, go to your repo → **Settings** → **Pages**.
3. Under "Build and deployment", set **Source** to `Deploy from a branch`.
4. Choose the branch (e.g. `main`) and folder `/ (root)`, then **Save**.
5. Wait ~1 minute, then refresh the Pages settings tab — GitHub shows you
   the live URL (something like `https://yourusername.github.io/catalogue/`).

That's it — totally free, and it updates automatically every time you push
to that branch.

6. Once you know your live URL, open `index.html` and update the
   `og:image` meta tag to point at it, e.g.
   `https://yourusername.github.io/catalogue/og-image.png`. This makes
   links look good when pasted into Slack/WhatsApp/iMessage. (It has to
   be the full live URL — those apps fetch the image separately, they
   can't use a relative path.)

## Editing products

Open `products.json` and edit the array. Each product looks like:

```json
{
  "name": "Product Name",
  "image": "https://example.com/image.jpg",
  "category": "Some Category",
  "badge": "Top Pick",
  "price": "$19.99",
  "link": "https://your-affiliate-link.com"
}
```

`badge` and `price` are optional — leave `badge` as `""` or omit `price`
entirely if a product doesn't have one.
