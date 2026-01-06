const products = [
  { id: 1, name: "Polera Bolivia", price: 80 },
  { id: 2, name: "Gorra Santa Cruz", price: 50 },
  { id: 3, name: "Taza personalizada", price: 35 },
];

const productList = document.getElementById("product-list");
const cartItemsEl = document.getElementById("cart-items");
const cartTotalEl = document.getElementById("cart-total");
const clearCartBtn = document.getElementById("clear-cart");

const STORAGE_KEY = "bolivia_shop_cart";

// ---- State ----
let cart = loadCart(); // [{ id, name, price, qty }]

// ---- Render Products ----
function renderProducts() {
  productList.innerHTML = "";
  products.forEach((product) => {
    const div = document.createElement("div");
    div.className = "product";
    div.innerHTML = `
      <h3>${product.name}</h3>
      <p>${product.price} Bs</p>
      <button class="add-to-cart" data-id="${product.id}">
        Agregar al carrito
      </button>
    `;
    productList.appendChild(div);
  });
}

// ---- Cart Logic ----
function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);
  saveCart();
  renderCart();
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
}

function calcTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

// ---- Render Cart ----
function renderCart() {
  cartItemsEl.innerHTML = "";

  if (cart.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Tu carrito está vacío.";
    cartItemsEl.appendChild(li);
    cartTotalEl.textContent = "0";
    return;
  }

  cart.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${item.name} x${item.qty} — ${item.price * item.qty} Bs</span>
      <button class="remove-item" data-id="${item.id}">Quitar</button>
    `;
    cartItemsEl.appendChild(li);
  });

  cartTotalEl.textContent = String(calcTotal());
}

// ---- LocalStorage ----
function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ---- Events (event delegation) ----
productList.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-to-cart");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  addToCart(id);
});

cartItemsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-item");
  if (!btn) return;

  const id = Number(btn.dataset.id);
  removeFromCart(id);
});

clearCartBtn.addEventListener("click", clearCart);

// ---- Init ----
renderProducts();
renderCart();
