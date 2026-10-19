
const $ = (id) => document.getElementById(id);

const STORAGE_PRODUCTS = "inventix_products_v1";
const STORAGE_SALES = "inventix_sales_v1";

function loadData(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

let products = loadData(STORAGE_PRODUCTS);
let sales = loadData(STORAGE_SALES);
let toastTimer;

const money = (value) =>
  "L " + Number(value).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const safeText = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function saveData() {
  try {
    localStorage.setItem(STORAGE_PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_SALES, JSON.stringify(sales));
    return true;
  } catch {
    showToast("No se pudieron guardar los datos. Revisa el espacio disponible.");
    return false;
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function getStatus(quantity) {
  if (quantity === 0) {
    return '<span class="pill out">Agotado</span>';
  }

  if (quantity <= 5) {
    return '<span class="pill low">Stock bajo</span>';
  }

  return '<span class="pill ok">Disponible</span>';
}

function renderStats() {
  $("totalProducts").textContent = products.length;

  $("totalUnits").textContent = products.reduce(
    (sum, product) => sum + product.quantity, 0
  );

  const value = products.reduce(
    (sum, product) => sum + product.price * product.quantity, 0
  );

  $("inventoryValue").textContent = money(value);

  $("lowStock").textContent = products.filter(
    (product) => product.quantity <= 5
  ).length;
}

function renderProducts() {
  const search = $("search").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const stock = $("stockFilter").value;

  const filtered = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search);
    const matchesCategory = !category || product.category === category;

    const matchesStock =
      !stock ||
      (stock === "low" && product.quantity > 0 && product.quantity <= 5) ||
      (stock === "out" && product.quantity === 0);

    return matchesSearch && matchesCategory && matchesStock;
  });

  $("productTable").innerHTML = filtered.length
    ? filtered.map((product) => `
      <tr>
        <td class="product-name">${safeText(product.name)}</td>
        <td>${safeText(product.category)}</td>
        <td class="product-price">${money(product.price)}</td>
        <td>${product.quantity}</td>
        <td>${getStatus(product.quantity)}</td>
        <td>
          <div class="action-group">
            <button class="action-btn" data-action="edit"
              data-id="${product.id}" aria-label="Editar producto">Editar</button>
            <button class="action-btn delete" data-action="delete"
              data-id="${product.id}" aria-label="Eliminar producto">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="6" class="empty-state">
        No se encontraron productos.
       </td></tr>`;

  $("productCount").textContent =
    `${filtered.length} de ${products.length} productos`;
}

function renderSaleOptions() {
  const select = $("saleProduct");
  const previousValue = select.value;

  select.innerHTML = '<option value="">Selecciona un producto</option>';

  products
    .filter((product) => product.quantity > 0)
    .forEach((product) => {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent =
        `${product.name} — ${product.quantity} disponibles`;
      select.appendChild(option);
    });

  if (products.some(
    (product) => product.id === previousValue && product.quantity > 0
  )) {
    select.value = previousValue;
  }

  updateSaleTotal();
}

function renderSales() {
  const recentSales = [...sales].reverse().slice(0, 10);

  $("salesTable").innerHTML = recentSales.length
    ? recentSales.map((sale) => `
      <tr>
        <td>${safeText(sale.date)}</td>
        <td>${safeText(sale.name)}</td>
        <td>${sale.quantity}</td>
        <td class="product-price">${money(sale.total)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4" class="empty-state">
        Todavía no hay ventas registradas.
       </td></tr>`;
}

function renderAll() {
  renderStats();
  renderProducts();
  renderSaleOptions();
  renderSales();
}

function resetForm() {
  $("productForm").reset();
  $("productId").value = "";
  $("formTitle").textContent = "Registrar producto";
  $("saveButton").textContent = "＋ Guardar producto";
  $("cancelEdit").hidden = true;
}

$("productForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const id = $("productId").value;
  const name = $("name").value.trim();
  const category = $("category").value;
  const price = Number($("price").value);
  const quantity = Number($("quantity").value);

  if (!name || !category ||
      !Number.isFinite(price) || price <= 0 ||
      !Number.isInteger(quantity) || quantity < 0) {
    showToast("Revisa los datos del producto.");
    return;
  }

  let previousProducts = products.map((product) => ({ ...product }));

  if (id) {
    const index = products.findIndex((product) => product.id === id);

    if (index === -1) {
      showToast("No se encontró el producto.");
      return;
    }

    products[index] = {
      ...products[index],
      name,
      category,
      price,
      quantity
    };
  } else {
    products.push({
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2),
      name,
      category,
      price,
      quantity
    });
  }

  if (!saveData()) {
    products = previousProducts;
    return;
  }

  resetForm();
  renderAll();
  showToast(id ? "Producto actualizado correctamente." : "Producto registrado correctamente.");
});

$("productTable").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const product = products.find(
    (item) => item.id === button.dataset.id
  );

  if (!product) return;

  if (button.dataset.action === "edit") {
    $("productId").value = product.id;
    $("name").value = product.name;
    $("category").value = product.category;
    $("price").value = product.price;
    $("quantity").value = product.quantity;

    $("formTitle").textContent = "Editar producto";
    $("saveButton").textContent = "Guardar cambios";
    $("cancelEdit").hidden = false;

    $("registro").scrollIntoView({ behavior: "smooth" });
    $("name").focus();
  }

  if (button.dataset.action === "delete") {
    const confirmed = confirm(
      `¿Seguro que deseas eliminar "${product.name}"?`
    );

    if (!confirmed) return;

    const previousProducts = products;
    products = products.filter((item) => item.id !== product.id);

    if (!saveData()) {
      products = previousProducts;
      return;
    }

    if ($("productId").value === product.id) {
      resetForm();
    }

    renderAll();
    showToast("Producto eliminado.");
  }
});

$("cancelEdit").addEventListener("click", resetForm);

$("search").addEventListener("input", renderProducts);
$("categoryFilter").addEventListener("change", renderProducts);
$("stockFilter").addEventListener("change", renderProducts);

function updateSaleTotal() {
  const product = products.find(
    (item) => item.id === $("saleProduct").value
  );

  const quantity = Number($("saleQuantity").value);

  $("saleTotal").value = money(
    product && Number.isInteger(quantity) && quantity > 0
      ? product.price * quantity
      : 0
  );
}

$("saleProduct").addEventListener("change", updateSaleTotal);
$("saleQuantity").addEventListener("input", updateSaleTotal);

$("saleForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const product = products.find(
    (item) => item.id === $("saleProduct").value
  );

  const quantity = Number($("saleQuantity").value);

  if (!product) {
    showToast("Selecciona un producto.");
    return;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    showToast("Ingresa una cantidad válida.");
    return;
  }

  if (quantity > product.quantity) {
    showToast(`Solo hay ${product.quantity} unidades disponibles.`);
    return;
  }

  const previousProducts = products.map((item) => ({ ...item }));
  const previousSales = [...sales];

  const total = product.price * quantity;

  product.quantity -= quantity;

  sales.push({
    id: String(Date.now()),
    date: new Date().toLocaleString("es-HN"),
    name: product.name,
    quantity,
    total
  });

  if (!saveData()) {
    products = previousProducts;
    sales = previousSales;
    return;
  }

  $("saleQuantity").value = 1;
  renderAll();
  showToast(`Venta registrada por ${money(total)}.`);
});

$("exportButton").addEventListener("click", () => {
  if (products.length === 0) {
    showToast("No hay productos para exportar.");
    return;
  }

  const rows = [
    ["Producto", "Categoría", "Precio", "Cantidad", "Valor total", "Estado"],
    ...products.map((product) => [
      product.name,
      product.category,
      product.price.toFixed(2),
      product.quantity,
      (product.price * product.quantity).toFixed(2),
      product.quantity === 0
        ? "Agotado"
        : product.quantity <= 5
          ? "Stock bajo"
          : "Disponible"
    ])
  ];

  const csv = "\uFEFF" + rows.map((row) =>
    row.map((cell) =>
      `"${String(cell).replace(/"/g, '""')}"`
    ).join(";")
  ).join("\r\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "inventix_inventario.csv";
  link.click();

  URL.revokeObjectURL(url);
  showToast("Archivo de inventario exportado.");
});

$("today").textContent = new Date().toLocaleDateString("es-HN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric"
});

renderAll();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(() => {
        console.log("INVENTIX está lista para funcionar como PWA.");
      })
      .catch((error) => {
        console.error("Error al activar el service worker:", error);
      });
  });
}
