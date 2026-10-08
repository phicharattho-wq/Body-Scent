document.addEventListener("DOMContentLoaded", function () {
  if (document.querySelector("#product-list")) initProductPage();
  if (document.querySelector("#orderForm")) initOrderPage();
  if (document.querySelector("#ordersTable tbody")) initAdminPage();
});

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwDzrnTRMCJXqnRPbofbd1hUbrGoNNcPRRKrRX5SMfcDbXcERbXV2kAqELbs8c_qxH0/exec";
const ORDERS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS00-mfqNDUfjMbBmqylM3NDhAZ8n96IIoFfvnvmsrMHRXhsDqgjeg0Q-__ZPNu0hYr_BZNOV2dvAq2/pub?gid=0&single=true&output=csv";

async function initProductPage() {
  const filterBar = document.querySelector("#filter-bar");
  const productList = document.querySelector("#product-list");
  if (!filterBar || !productList) return;

  try {
    const response = await fetch("products.json", { cache: "no-store" });
    if (!response.ok) throw new Error("โหลด products.json ไม่สำเร็จ");

    const products = await response.json();
    const filters = [
      ["all", "ทั้งหมด"],
      ["fresh", "Fresh"],
      ["sweet", "Sweet"],
      ["confident", "Confident"],
      ["romance", "Romance"]
    ];

    const params = new URLSearchParams(window.location.search);
    const requestedMood = (params.get("mood") || "all").toLowerCase();
    const validMoods = filters.map(item => item[0]);
    let activeMood = validMoods.includes(requestedMood) ? requestedMood : "all";

    filterBar.innerHTML = "";
    filters.forEach(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-ghost filter-btn";
      button.dataset.mood = value;
      button.textContent = label;
      filterBar.appendChild(button);
    });

    function renderProducts() {
      productList.innerHTML = "";

      const shown = activeMood === "all"
        ? products
        : products.filter(product =>
            String(product.mood).toLowerCase() === activeMood
          );

      if (!shown.length) {
        productList.innerHTML =
          '<p class="text-muted">ไม่พบสินค้าในหมวดนี้</p>';
        return;
      }

      shown.forEach(product => {
        const card = document.createElement("article");
        card.className = "card product-card";

        const imageWrap = document.createElement("div");
        imageWrap.className = "product-card__image";

        const img = document.createElement("img");
        img.src = String(product.image || "");
        img.alt = String(product.name || "");
        img.loading = "lazy";
        imageWrap.appendChild(img);

        const body = document.createElement("div");
        body.className = "product-card__body";

        const mood = document.createElement("span");
        mood.className =
          "mood-label mood-" + String(product.mood || "").toLowerCase();
        mood.textContent = String(product.mood || "").toUpperCase();

        const name = document.createElement("h3");
        name.className = "product-card__name";
        name.textContent = String(product.name || "");

        const size = document.createElement("p");
        size.className = "product-card__meta";
        size.textContent = String(product.size || "");

        const price = document.createElement("div");
        price.className = "product-card__price";
        price.textContent =
          Number(product.price || 0).toLocaleString("th-TH") + " บาท";

        const orderButton = document.createElement("a");
        orderButton.className = "btn btn-accent";
        orderButton.textContent = "สั่งซื้อ";

        const orderParams = new URLSearchParams({
          item: String(product.name || ""),
          price: String(product.price ?? "")
        });

        orderButton.href = "order.html?" + orderParams.toString();

        body.append(mood, name, size, price, orderButton);
        card.append(imageWrap, body);
        productList.appendChild(card);
      });

      filterBar.querySelectorAll("[data-mood]").forEach(button => {
        const active = button.dataset.mood === activeMood;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    filterBar.addEventListener("click", function (event) {
      const button = event.target.closest("[data-mood]");
      if (!button) return;

      activeMood = button.dataset.mood;
      renderProducts();
    });

    renderProducts();
  } catch (error) {
    console.error(error);
    productList.innerHTML =
      '<p class="text-muted">ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
  }
}

function initOrderPage() {
  const form = document.querySelector("#orderForm");
  const customerName = document.querySelector("#customerName");
  const contact = document.querySelector("#contact");
  const items = document.querySelector("#items");
  const total = document.querySelector("#total");
  const note = document.querySelector("#note");

  if (!form || !customerName || !contact || !items || !total || !note) {
    console.error("ไม่พบ element ที่จำเป็นใน order.html");
    return;
  }

  const params = new URLSearchParams(window.location.search);

  items.value = params.get("item") || "";
  total.value = params.get("price") || "";

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const payload = {
      customerName: customerName.value.trim(),
      contact: contact.value.trim(),
      items: items.value.trim(),
      total: total.value.trim(),
      note: note.value.trim()
    };

    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    })
      .then(() => {
        window.location.href = "thankyou.html";
      })
      .catch(error => {
        console.error(error);
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      });
  });
}

async function initAdminPage() {
  const tbody = document.querySelector("#ordersTable tbody");
  if (!tbody) return;

  try {
    const response = await fetch(ORDERS_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("โหลด CSV ไม่สำเร็จ");

    const rows = parseCSV(await response.text());
    tbody.innerHTML = "";

    const dataRows = rows.slice(1).filter(row =>
      row.some(cell => String(cell).trim() !== "")
    );

    dataRows.sort((a, b) => parseDateValue(b[0]) - parseDateValue(a[0]));

    if (!dataRows.length) {
      renderNoOrders(tbody);
      return;
    }

    dataRows.forEach(row => {
      const tr = document.createElement("tr");

      [
        row[0] || "",
        row[1] || "",
        row[2] || "",
        row[3] || "",
        row[4] || "",
        row[5] || ""
      ].forEach(value => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error(error);

    tbody.innerHTML = "";

    const tr = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = 6;
    td.textContent = "ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้";
    td.style.textAlign = "center";

    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch !== "\r") {
        field += ch;
      }
    }
  }

  row.push(field);

  if (row.length > 1 || row[0] !== "" || rows.length === 0) {
    rows.push(row);
  }

  return rows;
}

function parseDateValue(value) {
  if (!value) return 0;

  const text = String(value).trim();
  const direct = new Date(text);

  if (!Number.isNaN(direct.getTime())) {
    return direct.getTime();
  }

  const match = text.match(
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) return 0;

  let year = Number(match[3]);
  if (year > 2400) year -= 543;

  return new Date(
    year,
    Number(match[2]) - 1,
    Number(match[1]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0)
  ).getTime();
}

function renderNoOrders(tbody) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");

  td.colSpan = 6;
  td.textContent = "ยังไม่มีคำสั่งซื้อ";
  td.style.textAlign = "center";

  tr.appendChild(td);
  tbody.appendChild(tr);
}
