/* Storefront catalog and cart; product data always comes from the server. */
(() => {
  const products = Object.create(null);
  const storageKey = 'vintajoriginal-cart-v1';
  const ready = fetch('/api/products', { headers: { Accept: 'application/json' }, cache: 'no-store' })
    .then(async response => {
      if (!response.ok) throw new Error('catalog unavailable');
      const data = await response.json();
      for (const row of data.products || []) {
        if (!row || typeof row.sku !== 'string' || !Number.isSafeInteger(row.price_azn_qapik)) continue;
        let image = '';
        const imageValue = row.main_image_url || row.images?.[0]?.url || '';
        if (typeof imageValue === 'string' && imageValue) {
          try { const candidate = new URL(imageValue, location.origin); if (candidate.origin === location.origin) image = candidate.href; } catch { /* Ignore invalid catalog image URLs. */ }
        }
        products[row.sku] = {
          id: row.sku, sku: row.sku, name: row.name_az, price: row.price_azn_qapik,
          description: row.description_az || '', category: row.category_name_az || row.era || 'Vintage',
          categoryId: row.category_id, size: row.size_label || '—', material: row.material || '—',
          color: row.color || '', measurements: row.measurements || '', condition: row.condition_az || '—',
          image, alt: row.images?.[0]?.altTextAz || row.name_az || '',
        };
      }
      return true;
    }).catch(() => false);
  const readCart = () => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && item.id.length <= 100 && item.qty === 1) : [];
    } catch { return []; }
  };
  const money = qapik => `${(qapik / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`;
  const updateCartCount = cart => document.querySelectorAll('[data-cart-count]').forEach(node => { node.textContent = String(cart.length); });
  const writeCart = cart => { localStorage.setItem(storageKey, JSON.stringify(cart)); updateCartCount(cart); };
  const clearCart = () => writeCart([]);
  const toast = message => {
    const node = document.querySelector('.toast');
    if (!node) return;
    node.textContent = message; node.classList.add('visible'); clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('visible'), 2600);
  };
  const addProduct = id => {
    if (!products[id]) return toast('Bu məhsul hazırda satışda deyil.');
    const cart = readCart();
    if (cart.some(item => item.id === id)) return toast('Bu məhsul tək nüsxədir və artıq səbətindədir.');
    cart.push({ id, qty: 1 }); writeCart(cart); toast('Məhsul səbətə əlavə edildi.');
  };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const imageOrMark = (product, className) => {
    const visual = element('div', className);
    if (product.image) {
      const image = element('img'); image.src = product.image; image.alt = product.alt;
      image.loading = 'lazy'; image.decoding = 'async'; visual.append(image);
    } else {
      visual.classList.add('visual-placeholder');
      visual.append(element('span', 'visual-mark', 'V.'));
    }
    visual.append(element('span', 'product-label', 'Tək nüsxə'));
    return visual;
  };
  const card = (product, index) => {
    const article = element('article', 'product-card'); article.dataset.product = product.id; article.dataset.order = String(index);
    const link = element('a', 'product-card-link'); link.href = `/pages/product-detail.html?product=${encodeURIComponent(product.sku)}`;
    link.setAttribute('aria-label', `${product.name} — ${money(product.price)}`);
    link.append(imageOrMark(product, 'product-visual'));
    const info = element('div', 'product-card-info');
    const copy = element('div'); copy.append(element('p', 'product-category', product.category));
    const title = element('h3'); const titleLink = element('a', '', product.name); titleLink.href = link.href; title.append(titleLink); copy.append(title);
    info.append(copy, element('p', 'product-price', money(product.price)));
    article.append(link, info);
    if (product.description) article.append(element('p', 'product-short', product.description));
    const button = element('button', 'btn btn-card', 'Səbətə əlavə et'); button.type = 'button'; button.dataset.productId = product.id; button.classList.add('add-to-cart');
    article.append(button);
    return article;
  };
  const renderCart = () => {
    const host = document.getElementById('cart-content'); if (!host) return;
    const cart = readCart(); updateCartCount(cart);
    const available = cart.filter(item => products[item.id]);
    if (!available.length) {
      host.replaceChildren();
      const section = element('section', 'cart-empty'); section.append(element('div', 'cart-empty-mark', 'V.'), element('h2', '', cart.length ? 'Məhsul artıq mövcud deyil' : 'Səbət hələ boşdur'), element('p', '', cart.length ? 'Bu məhsul hazırda satışda deyil. Kolleksiyadan başqa parçalar seç.' : 'Bəyəndiyin parçanı seç — hər modeldən cəmi bir ədəd var.'));
      if (cart.length) { const clear = element('button', 'btn btn-card', 'Köhnə məhsulları səbətdən sil'); clear.type = 'button'; clear.dataset.action = 'clear-unavailable'; section.append(clear); }
      const link = element('a', 'btn btn-primary', 'Kolleksiyaya bax →'); link.href = 'products.html'; section.append(link); host.append(section); return;
    }
    const subtotal = available.reduce((sum, item) => sum + products[item.id].price, 0);
    const items = element('div', 'cart-items');
    for (const item of available) {
      const product = products[item.id]; const article = element('article', 'cart-item');
      article.append(imageOrMark(product, 'cart-item-visual'));
      const copy = element('div', 'cart-item-copy'); copy.append(element('h2', '', product.name), element('p', '', `${product.category} · Ölçü ${product.size}`), element('p', 'cart-unit-price', money(product.price)));
      const controls = element('div', 'cart-item-controls'); controls.append(element('span', 'qty-value', '1 ədəd'));
      const remove = element('button', 'remove-item', 'Səbətdən sil'); remove.type = 'button'; remove.dataset.action = 'remove'; remove.dataset.id = item.id; controls.append(remove); copy.append(controls);
      article.append(copy, element('p', 'cart-item-total', money(product.price))); items.append(article);
    }
    const aside = element('aside', 'cart-summary'); aside.append(element('h2', '', 'Sifariş xülasəsi'));
    const row = (label, value) => { const r = element('div', 'summary-row'); r.append(element('span', '', label), element('span', '', value)); return r; };
    const shipping = 1500; aside.append(row('Məhsullar', money(subtotal)), row('Çatdırılma', money(shipping)));
    const total = element('div', 'summary-total'); total.append(element('span', '', 'Cəmi'), element('span', '', money(subtotal + shipping))); aside.append(total, element('p', 'shipping-note', 'Çatdırılma haqqı sifariş zamanı dəqiqləşdiriləcək.'));
    const checkout = element('a', 'btn btn-primary', 'Sifarişi rəsmiləşdir →'); checkout.href = 'checkout.html'; aside.append(checkout);
    host.replaceChildren(items, aside);
  };
  window.VintajShop = Object.freeze({ products, ready, readCart, money, clearCart });
  document.addEventListener('DOMContentLoaded', async () => {
    const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();
    updateCartCount(readCart());
    const menuButton = document.querySelector('.mobile-menu-btn'); const nav = document.getElementById('primary-nav');
    if (menuButton && nav) menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') !== 'true'; menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? 'Menyunu bağla' : 'Menyunu aç'); nav.classList.toggle('is-open', open);
    });
    document.addEventListener('click', event => {
      const add = event.target.closest('.add-to-cart'); if (add) addProduct(add.dataset.productId);
      const remove = event.target.closest('[data-action="remove"]');
      if (remove) { writeCart(readCart().filter(item => item.id !== remove.dataset.id)); renderCart(); }
      if (event.target.closest('[data-action="clear-unavailable"]')) { writeCart(readCart().filter(item => products[item.id])); renderCart(); }
    });
    await ready;
    renderCart();
    const catalogGrids = [...document.querySelectorAll('.product-grid')];
    for (const grid of catalogGrids) {
      const featured = grid.id === 'featured-products';
      const list = Object.values(products).slice(0, featured ? 3 : 100);
      grid.replaceChildren(...list.map(card));
      const status = document.getElementById(featured ? 'featured-status' : 'catalog-status');
      if (status) { status.textContent = list.length ? '' : 'Hazırda satışda məhsul yoxdur. Yeni parçalar əlavə ediləndə burada görünəcək.'; status.hidden = Boolean(list.length); }
      const count = document.getElementById('product-count'); if (count) count.textContent = `${list.length} məhsul`;
      const categories = new Map(list.filter(p => p.categoryId !== null && p.categoryId !== undefined).map(p => [String(p.categoryId), p.category]));
      const categorySelect = document.getElementById('category-filter');
      if (categorySelect) for (const [id, name] of categories) { const option = element('option', '', name); option.value = id; categorySelect.append(option); }
    }
    if (!Object.keys(products).length) {
      const status = document.getElementById('catalog-status');
      if (status) { status.textContent = 'Kolleksiyanı yükləmək mümkün olmadı. Zəhmət olmasa bir az sonra yenidən cəhd edin.'; status.hidden = false; }
      const featuredStatus = document.getElementById('featured-status');
      if (featuredStatus) { featuredStatus.textContent = 'Seçilmiş məhsullar hazırda yüklənə bilmir.'; featuredStatus.hidden = false; }
    }
    const sort = document.getElementById('sort-select'), search = document.getElementById('product-search'), category = document.getElementById('category-filter');
    const updateCatalog = () => {
      const grid = document.getElementById('new-arrivals'); if (!grid) return;
      const cards = [...grid.querySelectorAll('.product-card')], query = (search?.value || '').trim().toLocaleLowerCase('az'), group = category?.value || 'all';
      cards.forEach(node => { const p = products[node.dataset.product]; node.hidden = !(`${p.name} ${p.category}`.toLocaleLowerCase('az').includes(query)) || (group !== 'all' && String(p.categoryId) !== group); });
      if (sort?.value === 'price-high' || sort?.value === 'price-low') { const direction = sort.value === 'price-high' ? -1 : 1; cards.sort((a,b) => (products[a.dataset.product].price - products[b.dataset.product].price) * direction); }
      else cards.sort((a,b) => Number(a.dataset.order) - Number(b.dataset.order));
      cards.forEach(node => grid.append(node));
      const visible = cards.filter(node => !node.hidden).length, count = document.getElementById('product-count'), empty = document.getElementById('catalog-empty');
      if (count) count.textContent = `${visible} məhsul`; if (empty) empty.hidden = visible > 0 || !cards.length;
    };
    [sort, search, category].filter(Boolean).forEach(control => control.addEventListener(control === search ? 'input' : 'change', updateCatalog));
    updateCatalog();
  });
})();
