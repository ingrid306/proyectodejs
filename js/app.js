/* ============================================================
   app.js (Optimizado, modular, moderno y accesible)
   - Render desde API
   - Filtros (categoría y búsqueda con debounce)
   - Carrito con persistencia
   - Validación de contacto
   - Accesibilidad mejorada
   ============================================================ */

const API_BASE = 'https://fakestoreapi.com';
const PRODUCTS_URL = `${API_BASE}/products`;
const CATEGORIES_URL = `${API_BASE}/products/categories`;

/* ---------- DOM Helper ---------- */
const $ = s => document.querySelector(s);

/* ---------- DOM refs ---------- */
const dom = {
  productList: $('#product-list'),
  categoryFilter: $('#category-filter'),
  search: $('#search'),
  productsFeedback: $('#products-feedback'),
  cartToggle: $('#cart-toggle'),
  cartPanel: $('#cart'),
  cartClose: $('#cart-close'),
  cartItems: $('#cart-items'),
  cartCount: $('#cart-count'),
  cartTotal: $('#cart-total'),
  clearCart: $('#clear-cart-btn'),
  checkout: $('#checkout-btn'),
  contactForm: $('#contact-form'),
  contactSuccess: $('#contact-success'),
  menuToggle: $('#menu-toggle'),
  nav: $('#nav'),
  year: $('#year'),
  siteHeader: $('#site-header'),
};

/* ---------- State ---------- */
let products = [];
let filtered = [];
let cart = loadCart();

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', init);

function init() {
  dom.year.textContent = new Date().getFullYear();
  setEvents();
  loadData();
  updateCartUI();
  observeHeaderScroll();
}

/* ============================================================
   EVENTOS
   ============================================================ */
function setEvents() {

  /* Menú móvil */
  dom.menuToggle?.addEventListener('click', () => {
    const isOpen = dom.nav.classList.toggle('open');
    dom.menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  /* Abrir / Cerrar carrito */
  dom.cartToggle.addEventListener('click', toggleCart);
  dom.cartClose.addEventListener('click', closeCart);

  /* Vaciar / Checkout */
  dom.clearCart.addEventListener('click', clearCart);
  dom.checkout.addEventListener('click', checkout);

  /* Filtros */
  dom.categoryFilter.addEventListener('change', applyFilters);
  dom.search.addEventListener('input', debounce(applyFilters, 250));

  /* Contacto */
  dom.contactForm.addEventListener('submit', handleContactForm);

  /* Delegación de eventos para productos */
  dom.productList.addEventListener('click', handleProductClick);

  /* Delegación para carrito (qty y borrar) */
  dom.cartItems.addEventListener('click', handleCartClick);

  /* Tecla Escape */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!dom.cartPanel.classList.contains('hidden')) closeCart();
    if (dom.nav.classList.contains('open')) {
      dom.nav.classList.remove('open');
      dom.menuToggle?.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ============================================================
   FETCH DE PRODUCTOS + CATEGORÍAS
   ============================================================ */
async function loadData() {
  showFeedback('Cargando productos...');

  try {
    const [prods, cats] = await Promise.all([
      fetchJSON(PRODUCTS_URL),
      fetchJSON(CATEGORIES_URL)
    ]);

    products = prods;
    filtered = [...products];

    renderCategories(cats);
    renderProducts(filtered);
    showFeedback('');
  } catch (err) {
    console.error(err);
    showFeedback('Error al cargar productos. Recargá la página.');
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  return res.json();
}

/* ============================================================
   RENDER
   ============================================================ */

function renderCategories(categories) {
  dom.categoryFilter.innerHTML = `
    <option value="all">Todas las categorías</option>
  ` + categories.map(c => `
    <option value="${c}">${capitalize(c)}</option>
  `).join('');
}

function renderProducts(list) {
  if (!list.length) {
    dom.productList.innerHTML = '<p>No se encontraron productos.</p>';
    return;
  }

  dom.productList.innerHTML = list.map(p => `
    <article class="product-card" role="listitem">
      <img loading="lazy" src="${escape(p.image)}" alt="${escape(p.title)}">
      <div class="product-info">
        <div class="product-title">${escape(p.title)}</div>
        <div class="product-price">$${p.price.toFixed(2)}</div>
        <div class="actions-row">
          <button class="add" data-id="${p.id}">Agregar</button>
          <button class="details" data-id="${p.id}">Detalles</button>
        </div>
      </div>
    </article>
  `).join('');
}

/* ============================================================
   FILTROS
   ============================================================ */

function applyFilters() {
  const q = dom.search.value.trim().toLowerCase();
  const cat = dom.categoryFilter.value;

  filtered = products.filter(p =>
    (cat === 'all' || p.category === cat) &&
    (p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
  );

  renderProducts(filtered);
}

/* ============================================================
   MANEJO DE PRODUCTOS (delegación)
   ============================================================ */

function handleProductClick(e) {
  const id = Number(e.target.dataset.id);
  if (!id) return;

  if (e.target.classList.contains('add')) {
    const prod = products.find(p => p.id === id);
    addToCart(prod);
  }

  if (e.target.classList.contains('details')) {
    window.open(`${PRODUCTS_URL}/${id}`, '_blank');
  }
}

/* ============================================================
   CARRITO
   ============================================================ */

function addToCart(prod) {
  const item = cart.find(i => i.id === prod.id);
  if (item) item.qty++;
  else cart.push({ ...prod, qty: 1 });

  saveCart();
  updateCartUI();
  toast('Producto agregado');
  openCart();
}

function handleCartClick(e) {
  const id = Number(e.target.dataset.id);
  if (!id) return;

  if (e.target.dataset.action === 'inc') changeQty(id, +1);
  if (e.target.dataset.action === 'dec') changeQty(id, -1);
  if (e.target.dataset.action === 'remove') removeFromCart(id);
}

function changeQty(id, q) {
  const item = cart.find(i => i.id === id);
  if (!item) return;

  item.qty = Math.max(1, item.qty + q);
  saveCart();
  updateCartUI();
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
}

function clearCart() {
  if (!cart.length) return;
  if (!confirm('¿Vaciar carrito?')) return;
  cart = [];
  saveCart();
  updateCartUI();
}

function updateCartUI() {
  dom.cartCount.textContent = cart.reduce((a, i) => a + i.qty, 0);

  if (!cart.length) {
    dom.cartItems.innerHTML = '<p>El carrito está vacío.</p>';
  } else {
    dom.cartItems.innerHTML = cart.map(i => `
      <div class="cart-item">
        <img src="${escape(i.image)}" alt="${escape(i.title)}">
        <div class="info">
          <strong>${escape(i.title)}</strong>
          <div>$${i.price.toFixed(2)} x ${i.qty}</div>
          <div class="qty">
            <button data-action="dec" data-id="${i.id}">−</button>
            <button data-action="inc" data-id="${i.id}">+</button>
            <button data-action="remove" data-id="${i.id}">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  dom.cartTotal.textContent =
    cart.reduce((t, i) => t + i.price * i.qty, 0).toFixed(2);
}

/* ---------- Carrito: abrir/cerrar ---------- */
function toggleCart() {
  dom.cartPanel.classList.contains('hidden') ? openCart() : closeCart();
}

function openCart() {
  dom.cartPanel.classList.remove('hidden');
  dom.cartToggle.setAttribute('aria-expanded', 'true');
}

function closeCart() {
  dom.cartPanel.classList.add('hidden');
  dom.cartToggle.setAttribute('aria-expanded', 'false');
}

/* ---------- Checkout Demo ---------- */
function checkout() {
  if (!cart.length) return alert('Carrito vacío');
  alert('Compra realizada (demo)');
  cart = [];
  saveCart();
  updateCartUI();
  closeCart();
}

/* ---------- Persistencia ---------- */
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch {
    return [];
  }
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

/* ============================================================
   FORMULARIO DE CONTACTO
   ============================================================ */
function handleContactForm(e) {
  e.preventDefault();
  clearFormErrors();

  const f = dom.contactForm;
  const data = {
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    message: f.message.value.trim()
  };

  const errors = validateContact(data);

  if (Object.keys(errors).length) {
    showFormErrors(errors);
    dom.contactSuccess.classList.add('hidden');
    return;
  }

  dom.contactSuccess.classList.remove('hidden');
  f.reset();
  setTimeout(() => dom.contactSuccess.classList.add('hidden'), 3500);
}

function validateContact({ name, email, message }) {
  const e = {};
  if (name.length < 2) e.name = 'El nombre debe tener al menos 2 caracteres';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido';
  if (message.length < 10) e.message = 'Mensaje demasiado corto';
  return e;
}

function showFormErrors(errors) {
  for (const [field, msg] of Object.entries(errors)) {
    const el = document.querySelector(`small.error[data-for="${field}"]`);
    if (el) el.textContent = msg;
  }
}

function clearFormErrors() {
  document.querySelectorAll('small.error').forEach(el => el.textContent = '');
}

/* ============================================================
   UTILIDADES
   ============================================================ */

function debounce(fn, d) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), d);
  };
}

function escape(str = '') {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[m]));
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function showFeedback(msg) {
  dom.productsFeedback.textContent = msg;
}

function toast(msg, time = 1500) {
  const div = document.createElement('div');
  div.textContent = msg;
  Object.assign(div.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    background: '#111',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '10px',
    opacity: 0,
    transition: 'opacity .2s',
    zIndex: 9999
  });
  document.body.appendChild(div);
  requestAnimationFrame(() => div.style.opacity = 1);
  setTimeout(() => {
    div.style.opacity = 0;
    setTimeout(() => div.remove(), 200);
  }, time);
}

/* Header pequeño al scrollear */
function observeHeaderScroll() {
  window.addEventListener('scroll', () => {
    dom.siteHeader.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}
