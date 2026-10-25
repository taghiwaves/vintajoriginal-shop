(() => {
  document.addEventListener('DOMContentLoaded', async () => {
    const shop = window.VintajShop;
    const empty = document.getElementById('checkout-empty');
    const content = document.getElementById('checkout-content');
    if (!shop || !empty || !content) return;
    if (!await shop.ready) {
      empty.hidden = false;
      empty.textContent = 'Məhsul kataloqu hazırda əlçatan deyil. Bir az sonra yenidən cəhd edin.';
      return;
    }
    const cart = shop.readCart();
    if (!cart.length) {
      empty.hidden = false;
      return;
    }
    content.hidden = false;
    const products = shop.products;
    if (cart.some(item => !products[item.id])) {
      empty.hidden = false;
      empty.textContent = 'Səbətindəki məhsullardan biri artıq satışda deyil. Səbətini yenilə və yenidən cəhd et.';
      return;
    }
    const itemsHost = document.getElementById('checkout-items');
    let subtotal = 0;
    const checkoutItems = cart.map(item => {
      const product = products[item.id];
      const total = product.price * item.qty;
      subtotal += total;
      const row = document.createElement('div'); row.className = 'checkout-item';
      const copy = document.createElement('span'); copy.textContent = product.name;
      const details = document.createElement('small'); details.textContent = `${item.qty} ədəd · ${product.size} ölçü`; copy.append(details);
      const amount = document.createElement('strong'); amount.textContent = shop.money(total);
      row.append(copy, amount); return row;
    });
    itemsHost.replaceChildren(...checkoutItems);
    const shipping = 499;
    const renderTotals = () => {
      document.getElementById('checkout-subtotal').textContent = shop.money(subtotal);
      document.getElementById('checkout-shipping').textContent = shop.money(shipping);
      document.getElementById('checkout-total').textContent = shop.money(subtotal + shipping);
    };
    renderTotals();

    let currentStep = 1;
    const showStep = step => {
      currentStep = step;
      document.querySelectorAll('[data-checkout-step]').forEach(panel => {
        panel.hidden = Number(panel.dataset.checkoutStep) !== step;
      });
      document.querySelectorAll('[data-step-indicator]').forEach(indicator => {
        const active = Number(indicator.dataset.stepIndicator) === step;
        indicator.classList.toggle('is-active', active);
        indicator.classList.toggle('is-complete', Number(indicator.dataset.stepIndicator) < step);
        if (active) indicator.setAttribute('aria-current', 'step');
        else indicator.removeAttribute('aria-current');
      });
      document.querySelector('.checkout-page').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => {
      const panel = document.querySelector(`[data-checkout-step="${currentStep}"]`);
      const invalid = [...panel.querySelectorAll('input, select')].find(field => !field.checkValidity());
      if (invalid) {
        invalid.reportValidity();
        invalid.focus();
        return;
      }
      showStep(Math.min(3, currentStep + 1));
    }));
    document.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', () => showStep(Math.max(1, currentStep - 1))));

    const result = document.getElementById('checkout-result');
    const showResult = message => {
      result.textContent = message;
      result.hidden = false;
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'cancelled') {
      showStep(3);
      showResult('Ödəniş tamamlanmadı. Səbətindəki məhsullar saxlanılıb; yenidən cəhd edə bilərsən.');
    } else if (params.get('payment') === 'success') {
      showStep(3);
      const sessionId = params.get('session_id');
      if (sessionId) {
        (async () => {
          for (let attempt = 0; attempt < 8; attempt++) {
            try {
              const response = await fetch(`/api/checkout/status/${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
              const data = await response.json();
              if (response.ok && data.paymentStatus === 'paid') {
                shop.clearCart();
                showResult(`Ödəniş təsdiqləndi. Sifariş nömrəsi: ${data.orderNumber}.`);
                return;
              }
              if (response.ok && data.paymentStatus === 'failed') {
                showResult('Ödəniş tamamlanmadı. Səbətindəki məhsullar saxlanılıb; yenidən cəhd edə bilərsən.');
                return;
              }
            } catch { /* Retry briefly while Stripe's signed webhook is processed. */ }
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          showResult('Stripe ödəniş dönüşü alındı; sifariş hələ serverdə təsdiqlənir. Bir azdan yenilə.');
        })();
      } else {
        showResult('Ödəniş statusunu yoxlamaq mümkün olmadı.');
      }
    }

    document.getElementById('preview-complete').addEventListener('click', async event => {
      const button = event.currentTarget;
      const form = document.getElementById('checkout-form');
      const invalid = [...form.querySelectorAll('input, select')].find(field => !field.checkValidity());
      if (invalid) {
        const panel = invalid.closest('[data-checkout-step]');
        showStep(Number(panel.dataset.checkoutStep));
        invalid.reportValidity();
        invalid.focus();
        return;
      }

      const formData = new FormData(form);
      const request = {
        email: formData.get('email'),
        phone: formData.get('phone'),
        shippingMethod: 'standard',
        shippingAddress: {
          name: formData.get('full-name'),
          address: formData.get('address'),
          city: formData.get('city'),
          region: formData.get('region'),
          country: 'AZ',
        },
        items: cart.map(item => ({ sku: products[item.id].sku, quantity: item.qty })),
      };
      button.disabled = true;
      button.textContent = 'Təhlükəsiz ödəniş səhifəsi açılır…';
      result.hidden = true;
      try {
        const response = await fetch('/api/checkout/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
        const data = await response.json();
        if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'Ödəniş səhifəsi açıla bilmədi.');
        const checkoutUrl = new URL(data.url);
        if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
          throw new Error('Stripe Checkout ünvanı təsdiqlənmədi.');
        }
        location.assign(checkoutUrl.href);
      } catch (error) {
        showResult(error.message || 'Ödəniş səhifəsi açıla bilmədi. Yenidən cəhd edin.');
        button.disabled = false;
        button.textContent = 'Stripe ilə təhlükəsiz ödəniş';
      }
    });
  });
})();
