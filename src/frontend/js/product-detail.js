document.addEventListener('DOMContentLoaded', async () => {
  const shop = window.VintajShop;
  if (!shop) return;
  const status = document.getElementById('detail-status');
  const layout = document.querySelector('.detail-layout');
  if (!await shop.ready) {
    if (status) { status.textContent = 'Məhsul məlumatlarını yükləmək mümkün olmadı. Bir az sonra yenidən cəhd edin.'; status.hidden = false; }
    if (layout) layout.hidden = true;
    return;
  }
  const requested = new URLSearchParams(location.search).get('product');
  const product = requested ? shop.products[requested] : null;
  if (!product) {
    if (status) { status.textContent = 'Bu məhsul hazırda mövcud deyil.'; status.hidden = false; }
    if (layout) layout.hidden = true;
    document.title = 'Məhsul mövcud deyil — Vintajoriginal';
    return;
  }
  if (status) status.hidden = true;
  if (layout) layout.hidden = false;
  document.querySelectorAll('[data-detail-name]').forEach(node => { node.textContent = product.name; });
  const set = (selector, value) => { const node = document.querySelector(selector); if (node) node.textContent = value; };
  set('[data-detail-category]', product.category);
  set('[data-detail-price]', shop.money(product.price));
  set('[data-detail-description]', product.description);
  set('[data-detail-size]', product.size);
  set('[data-detail-material]', product.material);
  set('[data-detail-condition]', product.condition);
  set('[data-detail-sku]', product.sku);
  set('[data-detail-color]', product.color || '—');
  set('[data-detail-measurements]', product.measurements || '—');
  const visual = document.querySelector('[data-detail-visual]');
  if (visual) {
    visual.classList.remove('visual-dress', 'visual-jacket', 'visual-blouse');
    visual.setAttribute('aria-label', `${product.name} üçün foto sahəsi`);
    const image = product.image ? document.createElement('img') : null;
    if (image) { image.src = product.image; image.alt = product.alt; image.loading = 'eager'; visual.insertBefore(image, visual.firstChild); }
  }
  const add = document.querySelector('.add-to-cart');
  if (add) add.dataset.productId = product.id;
  const availability = document.querySelector('.availability');
  if (availability) availability.textContent = 'Mövcuddur — cəmi 1 ədəd';
  document.title = `${product.name} — Vintajoriginal`;
});
