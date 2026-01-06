const products = [
  { id: 1, name: "Polera Bolivia", price: 80 },
  { id: 2, name: "Gorra Santa Cruz", price: 50 },
  { id: 3, name: "Taza personalizada", price: 35 }
];

const productList = document.getElementById("product-list");

function renderProducts() {
  products.forEach(product => {
    const div = document.createElement("div");
    div.className = "product";
    div.innerHTML = `
      <h3>${product.name}</h3>
      <p>${product.price} Bs</p>
      <button data-id="${product.id}">Agregar al carrito</button>
    `;
    productList.appendChild(div);
  });
}

renderProducts();
