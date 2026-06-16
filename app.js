const API_URL = 'https://script.google.com/macros/s/AKfycbwlM8l9xocKPsbfh6gjP3_yi10n4qVUfHhKmz_eGHyFK9LVSVbgIh4R61bVu0uF0Q5a3Q/exec';

let products = [];
let cart = JSON.parse(localStorage.getItem('goodwarehouse_cart') || '{}');
let currentCategory = '全部';
let currentCustomer = JSON.parse(localStorage.getItem('goodwarehouse_customer') || 'null');

const $ = (id) => document.getElementById(id);

function money(n) {
  return Number(n || 0).toLocaleString('zh-TW');
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_callback_' + Math.random().toString(36).substring(2);
    const script = document.createElement('script');

    window[callbackName] = function(data) {
      resolve(data);
      delete window[callbackName];
      document.body.removeChild(script);
    };

    const separator = url.includes('?') ? '&' : '?';
    script.src = url + separator + 'callback=' + callbackName + '&t=' + Date.now();

    script.onerror = function() {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(new Error('JSONP 載入失敗'));
    };

    document.body.appendChild(script);
  });
}

async function init() {
  await loadProducts();
  renderCategories();
  renderProducts();
  updateCartCount();

  if (currentCustomer) {
    renderCustomer();
    loadCustomerSummary();
  } else {
    showLogin();
  }
}

function showLogin() {
  const box = document.createElement('div');
  box.id = 'loginModal';
  box.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:20px;padding:22px;width:100%;max-width:360px;">
        <h2 style="margin-top:0;color:#0046b8;">好貨倉會員登入</h2>
        <input id="loginAccount" placeholder="帳號" style="width:100%;padding:14px;margin-bottom:10px;border:1px solid #ddd;border-radius:12px;">
        <input id="loginPassword" placeholder="密碼" type="password" style="width:100%;padding:14px;margin-bottom:14px;border:1px solid #ddd;border-radius:12px;">
        <button onclick="loginCustomer()" style="width:100%;padding:14px;border:0;border-radius:12px;background:#0046b8;color:white;font-weight:900;">登入</button>
      </div>
    </div>
  `;
  document.body.appendChild(box);
}

async function loginCustomer() {
  const account = $('loginAccount').value.trim();
  const password = $('loginPassword').value.trim();

  if (!account || !password) {
    alert('請輸入帳號密碼');
    return;
  }

  const data = await jsonp(
    `${API_URL}?action=loginCustomer&account=${encodeURIComponent(account)}&password=${encodeURIComponent(password)}`
  );

  if (!data.ok) {
    alert(data.message || '登入失敗');
    return;
  }

  currentCustomer = data.customer;
  localStorage.setItem('goodwarehouse_customer', JSON.stringify(currentCustomer));

  document.getElementById('loginModal')?.remove();

  renderCustomer();
  loadCustomerSummary();
}

function logoutCustomer() {
  localStorage.removeItem('goodwarehouse_customer');
  currentCustomer = null;
  location.reload();
}

function renderCustomer() {
  const brand = document.querySelector('.brand');
  if (brand && currentCustomer) {
    brand.innerHTML = `🏬 ${currentCustomer.shopName || '好貨倉'}`;
  }
}

async function loadCustomerSummary() {
  if (!currentCustomer?.uid) return;

  const data = await jsonp(
    `${API_URL}?action=getCustomerSummary&uid=${encodeURIComponent(currentCustomer.uid)}`
  );

  if (data.ok) {
    const summaryCards = document.querySelectorAll('.summary strong');
    if (summaryCards[0]) summaryCards[0].textContent = money(data.monthPurchase);
    if (summaryCards[1]) summaryCards[1].textContent = money(data.monthReward);
  }
}

async function loadProducts() {
  try {
    const data = await jsonp(`${API_URL}?action=products`);
    if (!data.ok) throw new Error(data.message || 'API 回傳失敗');
    products = data.products || [];
  } catch (err) {
    console.error(err);
    alert('商品讀取失敗，請確認 Apps Script 是否部署成功');
  }
}

function renderCategories() {
  const cats = ['全部', ...new Set(products.map(p => p.category).filter(Boolean))];

  $('categories').innerHTML = cats.map(cat => `
    <button class="category ${cat === currentCategory ? 'active' : ''}" onclick="setCategory('${cat}')">
      ${cat}
    </button>
  `).join('');
}

function setCategory(cat) {
  currentCategory = cat;
  renderCategories();
  renderProducts();
}

function renderProducts() {
  const keyword = $('keyword')?.value?.trim().toLowerCase() || '';

  const list = products.filter(p => {
    const matchCategory = currentCategory === '全部' || p.category === currentCategory;
    const text = `${p.name || ''} ${p.barcode || ''} ${p.keywords || ''}`.toLowerCase();
    return matchCategory && (!keyword || text.includes(keyword));
  });

  if (!list.length) {
    $('products').innerHTML = `<div style="padding:24px;text-align:center;color:#6b7280;">目前沒有商品資料</div>`;
    return;
  }

  $('products').innerHTML = list.map(p => {
    const rewardClass = Number(p.rewardRate) === 3 ? 'r3' : Number(p.rewardRate) === 1 ? 'r1' : 'r0';
    const rewardText = Number(p.rewardRate) > 0 ? `${p.rewardRate}% 回饋` : '不回饋';
    const unit = Number(p.purchaseUnit || 1);

    return `
      <div class="product-card">
        <img src="${p.image || 'https://placehold.co/300x300/eef4ff/0046b8?text=好貨倉'}" />
        <div>
          <div class="product-name">${p.name || ''}</div>
          <div class="barcode">${p.barcode || ''}</div>
          <div class="price-label">批發價</div>
          <div class="wholesale-price">${money(p.wholesalePrice)}</div>
          <div class="suggest-price">建議售價 ${money(p.suggestPrice)}</div>
          <span class="reward ${rewardClass}">${rewardText}</span>
          ${unit > 1 ? `<div class="unit">需單包購買 ${unit} 入</div>` : ''}
        </div>
        <button class="add-btn" onclick="addToCart('${p.productId}')">+</button>
      </div>
    `;
  }).join('');
}

function addToCart(productId) {
  const product = products.find(p => p.productId === productId);
  if (!product) return;

  const step = Number(product.purchaseUnit || 1);
  cart[productId] = (cart[productId] || 0) + step;

  saveCart();
  updateCartCount();
}

function changeQty(productId, direction) {
  const product = products.find(p => p.productId === productId);
  if (!product) return;

  const step = Number(product.purchaseUnit || 1);
  const next = Number(cart[productId] || 0) + direction * step;

  if (next <= 0) delete cart[productId];
  else cart[productId] = next;

  saveCart();
  updateCartCount();
  renderCart();
}

function saveCart() {
  localStorage.setItem('goodwarehouse_cart', JSON.stringify(cart));
}

function updateCartCount() {
  $('cartCount').textContent = Object.keys(cart).length;
}

function showCart() {
  $('app').classList.add('hidden');
  $('cartPage').classList.remove('hidden');
  renderCart();
}

function backHome() {
  $('cartPage').classList.add('hidden');
  $('app').classList.remove('hidden');
}

function renderCart() {
  const ids = Object.keys(cart);
  const cartProducts = ids.map(id => products.find(p => p.productId === id)).filter(Boolean);

  let total = 0;
  let reward = 0;

  if (!cartProducts.length) {
    $('cartItems').innerHTML = `<div style="padding:24px;text-align:center;color:#6b7280;">補貨車是空的</div>`;
  } else {
    $('cartItems').innerHTML = cartProducts.map(p => {
      const qty = Number(cart[p.productId] || 0);
      const amount = Number(p.wholesalePrice || 0) * qty;
      const rewardAmount = amount * Number(p.rewardRate || 0) / 100;

      total += amount;
      reward += rewardAmount;

      return `
        <div class="cart-item">
          <img src="${p.image || 'https://placehold.co/300x300/eef4ff/0046b8?text=好貨倉'}" />
          <div>
            <div class="product-name">${p.name || ''}</div>
            <div class="price-label">批發價</div>
            <div class="wholesale-price">${money(p.wholesalePrice)}</div>
            <div class="suggest-price">小計 ${money(amount)}</div>
            <div class="qty-row">
              <button onclick="changeQty('${p.productId}', -1)">−</button>
              <strong>${qty}</strong>
              <button onclick="changeQty('${p.productId}', 1)">＋</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  $('cartTotal').textContent = money(total);
  $('cartReward').textContent = money(Math.round(reward));
}

async function submitOrder() {
  if (!currentCustomer) {
    alert('請先登入會員');
    showLogin();
    return;
  }

  const ids = Object.keys(cart);

  if (!ids.length) {
    alert('補貨車是空的');
    return;
  }

  const items = ids.map(id => {
    const p = products.find(x => x.productId === id);
    return {
      productId: p.productId,
      name: p.name,
      costPrice: p.costPrice,
      salePrice: p.wholesalePrice,
      qty: cart[id],
      rewardRate: p.rewardRate
    };
  });

  const payload = {
    uid: currentCustomer.uid,
    customerName: currentCustomer.shopName,
    phone: currentCustomer.phone,
    address: currentCustomer.address,
    items
  };

  const url =
    API_URL +
    '?action=createOrder' +
    '&payload=' +
    encodeURIComponent(JSON.stringify(payload));

  const data = await jsonp(url);

  if (data.ok) {
    alert(
      '下單成功\n' +
      '訂單編號：' + data.orderId + '\n' +
      '本單總金額：' + money(data.orderAmount) + '\n' +
      '本單回饋：' + money(data.rewardAmount)
    );

    cart = {};
    saveCart();
    updateCartCount();
    backHome();
    renderProducts();
    loadCustomerSummary();
  } else {
    alert('下單失敗：' + (data.message || '未知錯誤'));
  }
}

function scrollToProducts() {
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

init();
