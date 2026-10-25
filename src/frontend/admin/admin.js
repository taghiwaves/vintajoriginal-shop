const $ = selector => document.querySelector(selector);
const setupView = $('#setupView');
const loginView = $('#loginView');
const appView = $('#appView');
const editor = $('#editor');
let products = [];
let selectedSku = null;
let changed = false;

function toast(message, error = false) {
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Anfrage fehlgeschlagen (${response.status}).`);
  return result;
}

async function showLogin() {
  setupView.hidden = true;
  loginView.hidden = false;
  appView.hidden = true;
  try {
    const status = await api('/api/admin/status');
    $('#setupHint').hidden = status.configured;
    if (!status.configured) {
      setupView.hidden = false;
      loginView.hidden = true;
    }
  } catch { /* Show login even while the API is unavailable. */ }
}

async function signIn(password) {
  await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
  setupView.hidden = true;
  loginView.hidden = true;
  appView.hidden = false;
  await loadProducts();
}

function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderList() {
  $('#productCount').textContent = products.length;
  $('#productList').innerHTML = products.map(product => `<button class="product-row${product.sku === selectedSku ? ' selected' : ''}" data-sku="${escapeHTML(product.sku)}" type="button">
    <img class="thumb" src="${escapeHTML(product.main_image_url || '/images/products/Zeytun.jpg')}" alt="">
    <span class="row-copy"><strong>${escapeHTML(product.name_az)}</strong><small>${escapeHTML(product.sku)} · ${(product.price_azn_qapik / 100).toFixed(2)} AZN</small><span><i class="status-dot${product.is_published ? ' live' : ''}"></i>${product.is_published ? 'Im Shop' : 'Entwurf'}</span></span></button>`).join('');
  document.querySelectorAll('.product-row').forEach(button => button.addEventListener('click', () => selectProduct(button.dataset.sku)));
}

function field(label, key, value = '', options = {}) {
  const tag = options.multiline ? 'textarea' : 'input';
  const type = options.type || 'text';
  const required = options.required ? 'required' : '';
  const min = options.min !== undefined ? `min="${options.min}"` : '';
  const step = options.step ? `step="${options.step}"` : '';
  const max = options.max ? `maxlength="${options.max}"` : '';
  return `<div class="field${options.full ? ' full' : ''}"><label for="f-${key}">${label}${options.required ? ' *' : ''}</label><${tag} id="f-${key}" name="${key}" ${tag === 'input' ? `type="${type}"` : ''} ${required} ${min} ${step} ${max}>${tag === 'textarea' ? escapeHTML(value) : ''}</${tag}></div>`;
}

function drawEditor(product = null) {
  selectedSku = product?.sku || null;
  changed = false;
  renderList();
  const value = key => product?.[key] ?? '';
  editor.innerHTML = `<div class="editor-head"><div><h2>${product ? escapeHTML(product.name_az) : 'Neuer Artikel'}</h2><p>${product ? `SKU ${escapeHTML(product.sku)} · ${product.is_published ? 'Im Shop sichtbar' : 'Noch unveröffentlicht'}` : 'Neuer Artikel wird zunächst als Entwurf gespeichert.'}</p></div>${product ? `<div class="editor-actions"><button id="publishButton" class="button ${product.is_published ? 'quiet' : 'primary'}" type="button">${product.is_published ? 'Aus Shop nehmen' : 'Veröffentlichen'}</button></div>` : ''}</div>
  <div class="editor-body"><form id="productForm"><div class="form-grid">
    ${product ? `<div class="field"><label for="f-sku">SKU</label><input id="f-sku" value="${escapeHTML(product.sku)}" disabled></div>` : field('SKU (eindeutig)', 'sku', '', { required: true, max: 100 })}
    ${field('Produktname (Aserbaidschanisch)', 'name_az', value('name_az'), { required: true, max: 255 })}
    ${field('Preis (AZN)', 'price_azn', product ? (product.price_azn_qapik / 100).toFixed(2) : '', { required: true, type: 'number', min: '0.01', step: '0.01' })}
    ${field('Kategorie', 'category_name_az', value('category_name_az'), { required: true, max: 255 })}
    ${field('Zustand', 'condition_az', value('condition_az'), { required: true, max: 255 })}
    ${field('Größe', 'size_label', value('size_label'), { max: 80 })}
    ${field('Marke', 'brand', value('brand'), { max: 255 })}
    ${field('Material', 'material', value('material'), { max: 160 })}
    ${field('Farbe', 'color', value('color'), { max: 100 })}
    ${field('Epoche / Jahr', 'era', value('era'), { max: 100 })}
    ${field('Bestand', 'stock_quantity', product ? value('stock_quantity') : '1', { type: 'number', min: '0', step: '1' })}
    ${field('Maße / Passform', 'measurements', value('measurements'), { multiline: true, max: 2000, full: true })}
    ${field('Beschreibung (Aserbaidschanisch)', 'description_az', value('description_az'), { multiline: true, max: 10000, full: true })}
  </div></form>
  ${product ? `<div class="images-head"><h3>Produktfotos</h3><span class="muted">JPG, PNG oder WebP · bis 8 MB je Bild</span></div><div id="imageGrid" class="image-grid"></div><form id="imageForm" class="form-grid" style="margin-top:14px"><div class="field"><label for="imageFile">Fotos hinzufügen</label><input id="imageFile" type="file" accept="image/jpeg,image/png,image/webp" multiple></div><div class="field"><label for="imageAlt">Bildbeschreibung (optional)</label><input id="imageAlt" maxlength="255" placeholder="z. B. Vorderansicht"></div><div class="field full"><button id="uploadButton" class="button quiet" type="submit">Fotos hochladen</button></div></form>` : '<div class="images-head"><h3>Produktfoto</h3><span class="muted">Nach dem Speichern lassen sich weitere Fotos ergänzen.</span></div><div class="field"><label for="firstImage">Hauptfoto</label><input id="firstImage" form="productForm" name="image" type="file" accept="image/jpeg,image/png,image/webp" required><small>JPG, PNG oder WebP · bis 8 MB</small></div>'}
  ${product ? `<div class="publish-row"><div><strong>Im Shop sichtbar</strong><small>Ausverkaufte Artikel werden automatisch nicht angezeigt.</small></div><label class="switch"><input id="publishSwitch" type="checkbox" ${product.is_published ? 'checked' : ''}><span></span></label></div>` : ''}
  <div class="editor-footer"><button id="saveButton" class="button primary" type="submit" form="productForm">${product ? 'Änderungen speichern' : 'Artikel speichern'}</button></div></div>`;
  $('#productForm').addEventListener('input', () => { changed = true; });
  $('#productForm').addEventListener('submit', saveProduct);
  if (product) {
    renderImages(product);
    $('#publishSwitch').addEventListener('change', setPublished);
    $('#publishButton').addEventListener('click', () => setPublished(!product.is_published));
    $('#imageForm').addEventListener('submit', uploadImages);
  }
}

function renderImages(product) {
  const images = product.images || [];
  $('#imageGrid').innerHTML = images.length ? images.map((image, index) => `<div class="image-card"><img src="${escapeHTML(image.url)}" alt="${escapeHTML(image.altTextAz || '')}"><button type="button" title="Foto entfernen" aria-label="Foto ${index + 1} entfernen" data-image-id="${image.id}">×</button><p>${image.url === product.main_image_url ? 'Hauptfoto' : 'Zusatzfoto'}</p></div>`).join('') : '<div class="empty-images">Noch keine Produktfotos.</div>';
  document.querySelectorAll('[data-image-id]').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('Dieses Produktfoto entfernen?')) return;
    try {
      const result = await api(`/api/admin/products/${encodeURIComponent(product.sku)}/images/${button.dataset.imageId}`, { method: 'DELETE' });
      product.main_image_url = result.mainImageUrl;
      product.images = product.images.filter(image => String(image.id) !== button.dataset.imageId);
      renderImages(product); renderList(); toast('Foto entfernt.');
    } catch (error) { toast(error.message, true); }
  }));
}

async function loadProducts(preferredSku = null) {
  const result = await api('/api/admin/products');
  products = result.products;
  renderList();
  if (preferredSku) selectProduct(preferredSku, true);
}

function selectProduct(sku, force = false) {
  if (!force && changed && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
  drawEditor(products.find(product => product.sku === sku));
}

function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

async function saveProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = $('#saveButton'); button.disabled = true;
  try {
    const data = formData(form);
    const file = $('#firstImage')?.files[0];
    if (!selectedSku && !file) throw new Error('Bitte wähle ein Hauptfoto aus.');
    await api(selectedSku ? `/api/admin/products/${encodeURIComponent(selectedSku)}` : '/api/admin/products', {
      method: selectedSku ? 'PUT' : 'POST', body: JSON.stringify(data),
    });
    if (!selectedSku) {
      const result = await api('/api/admin/products');
      const created = result.products.find(product => product.sku === data.sku);
      if (created && file) await uploadFile(created.sku, file, '');
      products = (await api('/api/admin/products')).products;
      toast('Artikel als Entwurf gespeichert.');
      drawEditor(products.find(product => product.sku === data.sku));
    } else {
      toast('Änderungen gespeichert.');
      changed = false;
      await loadProducts(selectedSku);
    }
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Foto ${file.name} konnte nicht gelesen werden.`));
    reader.readAsDataURL(file);
  });
}

async function uploadFile(sku, file, altTextAz) {
  if (file.size > 8 * 1024 * 1024) throw new Error(`${file.name} ist größer als 8 MB.`);
  await api(`/api/admin/products/${encodeURIComponent(sku)}/images`, { method: 'POST', body: JSON.stringify({ data: await readFile(file), altTextAz }) });
}

async function uploadImages(event) {
  event.preventDefault();
  const files = [...$('#imageFile').files];
  if (!files.length) return toast('Bitte wähle mindestens ein Foto aus.', true);
  const button = $('#uploadButton'); button.disabled = true;
  try {
    for (const file of files) await uploadFile(selectedSku, file, $('#imageAlt').value.trim());
    products = (await api('/api/admin/products')).products;
    const product = products.find(item => item.sku === selectedSku);
    toast(`${files.length} Foto${files.length === 1 ? '' : 's'} hinzugefügt.`);
    drawEditor(product);
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

async function setPublished(eventOrValue) {
  const product = products.find(item => item.sku === selectedSku);
  const publish = typeof eventOrValue === 'boolean' ? eventOrValue : eventOrValue.currentTarget.checked;
  try {
    const result = await api(`/api/admin/products/${encodeURIComponent(selectedSku)}/publish`, { method: 'PATCH', body: JSON.stringify({ is_published: publish }) });
    product.is_published = result.product.is_published;
    drawEditor(product); toast(publish ? 'Artikel veröffentlicht.' : 'Artikel aus dem Shop genommen.');
  } catch (error) { if (typeof eventOrValue !== 'boolean') $('#publishSwitch').checked = !publish; toast(error.message, true); }
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('#loginMessage').textContent = '';
  try {
    await signIn($('#password').value);
    $('#password').value = '';
  } catch (error) { $('#loginMessage').textContent = error.message; }
});

$('#setupForm').addEventListener('submit', async event => {
  event.preventDefault();
  const password = $('#setupPassword').value;
  $('#setupMessage').textContent = '';
  if (!event.currentTarget.reportValidity()) return;
  try {
    await api('/api/admin/setup', { method: 'POST', body: JSON.stringify({ password, confirmation: $('#setupConfirmation').value }) });
    await signIn(password);
    $('#setupPassword').value = '';
    $('#setupConfirmation').value = '';
  } catch (error) { $('#setupMessage').textContent = error.message; }
});

$('#logoutButton').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch { /* Clear the local view even if the session expired. */ }
  products = []; selectedSku = null; await showLogin();
});

$('#newButton').addEventListener('click', () => {
  if (changed && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
  drawEditor();
});

$('#paymentSetupButton').addEventListener('click', async () => {
  const dialog = $('#stripeDialog');
  $('#stripeTestKey').value = '';
  $('#stripeTestStatus').textContent = '';
  dialog.showModal();
  try {
    const status = await api('/api/admin/stripe-test-status');
    $('#stripeTestStatus').textContent = status.configured ? 'Ein Stripe-Testschlüssel ist bereits lokal eingerichtet. Du kannst ihn hier ersetzen.' : 'Noch kein Stripe-Testschlüssel eingerichtet.';
    $('#stripeTestStatus').classList.toggle('success', status.configured);
  } catch (error) { $('#stripeTestStatus').textContent = error.message; }
});

$('#stripeTestForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = $('#stripeTestSave');
  const secretKey = $('#stripeTestKey').value.trim();
  button.disabled = true;
  $('#stripeTestStatus').classList.remove('success');
  $('#stripeTestStatus').textContent = 'Verbindung wird bei Stripe geprüft …';
  try {
    const result = await api('/api/admin/stripe-test-key', { method: 'POST', body: JSON.stringify({ secretKey }) });
    $('#stripeTestStatus').textContent = result.verified
      ? 'Testschlüssel geprüft und lokal gespeichert. Test-Checkout ist jetzt bereit.'
      : 'Testschlüssel lokal gespeichert, aber noch nicht bei Stripe verifiziert. Der lokale Server kann api.stripe.com derzeit nicht erreichen; Testzahlungen funktionieren erst nach Freigabe der Verbindung.';
    $('#stripeTestStatus').classList.add('success');
  } catch (error) {
    $('#stripeTestStatus').textContent = error.message;
  } finally {
    $('#stripeTestKey').value = '';
    button.disabled = false;
  }
});

(async () => {
  try { await loadProducts(); loginView.hidden = true; appView.hidden = false; }
  catch { await showLogin(); }
})();
