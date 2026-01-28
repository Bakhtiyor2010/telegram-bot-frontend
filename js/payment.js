const BASE_URL = "https://fayzullaev-ielts-school-backend.onrender.com/api";

const API_USERS = `${BASE_URL}/users`;
const API_GROUPS = `${BASE_URL}/groups`;
const API_ATTENDANCE = `${BASE_URL}/attendance`;

let users = [];
let selectedUsers = new Set();
let groups = [];
let currentGroupId = null;
let ADMIN_ROLE = null;

const tableBody = document.getElementById("tableBody");
const groupList = document.getElementById("groupList");
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");

hamburger.addEventListener("click", () => {
  navLinks.classList.toggle("show");
});

async function loadGroups() {
  const loader = document.getElementById("groupLoader");
  loader.style.display = "block";
  groupList.innerHTML = "";

  try {
    const res = await fetch(API_GROUPS);
    if (!res.ok) throw new Error("Failed to load groups");
    const data = await res.json();

    groups = data.map((g) => ({ ...g, id: g.id || g._id }));

    groups.sort((a, b) => {
      if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
      if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
      return 0;
    });

    if (groups.length === 0) {
      groupList.innerHTML = `<div style="text-align:center;color:gray;">No groups</div>`;
      document.getElementById("groupTitle").textContent = "No groups";
      currentGroupId = null;
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No users to show</td></tr>`;
      return;
    }

    renderGroups();
  } catch (err) {
    console.error(err);
    alert("Failed to load groups");
  } finally {
    loader.style.display = "none";
  }
}

function renderGroups() {
  groupList.innerHTML = "";

  groups.forEach((g) => {
    const div = document.createElement("div");
    div.style.display = "flex";
    div.style.alignItems = "center";
    div.style.justifyContent = "space-between";
    div.style.marginBottom = "10px";

    const nameBtn = document.createElement("button");
    nameBtn.textContent = g.name;
    nameBtn.style.flexGrow = "1";
    nameBtn.style.padding = "8px";
    nameBtn.style.border = "1px solid #007bff";
    nameBtn.style.borderRadius = "4px";
    nameBtn.style.background = "#007bff";
    nameBtn.style.color = "white";
    nameBtn.style.cursor = "pointer";

    nameBtn.onclick = async () => {
      currentGroupId = g.id;
      document.getElementById("groupTitle").textContent =
        "Group name: " + g.name;
      await loadUsers();
    };

    div.appendChild(nameBtn);
    groupList.appendChild(div);
  });
}

async function loadUsers() {
  if (!currentGroupId) return;

  tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;font-size:20px;">Loading...</td></tr>`;

  let paymentsData = {}; // <- default empty in case payments fail

  try {
    // 1️⃣ Load users
    const resUsers = await fetch(API_USERS);
    if (!resUsers.ok) throw new Error("Failed to load users");
    const usersData = await resUsers.json();

    // 2️⃣ Load payments (optional)
    try {
      const resPayments = await fetch(`${BASE_URL}/payments`);
      if (!resPayments.ok) throw new Error("Failed to load payments");
      paymentsData = await resPayments.json();

      // Convert paidAt to Date objects safely
      for (const key in paymentsData) {
        if (!paymentsData[key] || !paymentsData[key].history) continue;
        paymentsData[key].history.forEach(h => {
          if (h.date instanceof Object && h.date !== null) h.date = new Date(h.date);
        });
      }
    } catch (err) {
      console.warn("Payments not loaded:", err.message);
    }

    // 3️⃣ Merge users with payments
users = usersData
  .map(u => {
    const payment = paymentsData[u.id] || {};
    const lastPaid =
      payment.history && payment.history.length
        ? payment.history
            .filter(h => h.status === "paid" && h.date)
            .map(h => ({ ...h, date: new Date(h.date) })) // convert to Date
            .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
        : null;

    return {
      ...u,
      id: u.id || u._id,
      isPaid: !!lastPaid,
      paidAt: lastPaid ? lastPaid.date : null,
    };
  })
  .filter(u => u.groupId && u.groupId === currentGroupId);

    // 4️⃣ Sort: unpaid first
    users.sort((a, b) => (a.isPaid === b.isPaid ? 0 : a.isPaid ? 1 : -1));

    renderTable();
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:red">Failed to load users</td></tr>`;
  }
}

function renderTable() {
  tableBody.innerHTML = "";

  if (!users.length) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center">No users in this group</td></tr>`;
    return;
  }

  users.forEach((u, index) => {
    const tr = document.createElement("tr");

    tr.style.background = u.isPaid ? "#d4edda" : "#f8d7da";

    if (selectedUsers.has(u.id)) tr.classList.add("selected");

    const phone = u.phone ? (u.phone.startsWith("+998") ? u.phone : "+998" + u.phone) : "N/A";
    const paymentStatus = u.isPaid ? (u.paidAt ? formatDate(u.paidAt) : "Paid") : "Unpaid";

    tr.innerHTML = `
      <td>
        <input type="checkbox" ${selectedUsers.has(u.id) ? "checked" : ""} onchange="toggleSelect('${u.id}', this)">
      </td>
      <td>${index + 1}</td>
      <td>${u.surname || "-"}</td>
      <td>${u.name || "-"}</td>
      <td><a href="tel:${phone}">${phone}</a></td>
      <td>
        <button class="paid-btn" style="background: #28a745;" data-id="${u.id}">
          <i class="fa-solid fa-circle-check"></i>
        </button>
        <button style="background: #dc3545;" onclick="setUnpaid('${u.id}')">
          <i class="fa-solid fa-circle-xmark"></i>
        </button>
        <button style="background: #ffc107;" onclick="viewPaymentHistory('${u.id}')">
          <i class="fa-solid fa-clock-rotate-left"></i>
        </button>
      </td>
      <td>${paymentStatus}</td>
    `;

    tableBody.appendChild(tr);
  });
}

tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".paid-btn");
  if (!btn) return;

  const userId = btn.dataset.id;
  const user = users.find((u) => u.id === userId);
  if (!user) return;

  setPaid(user.id, user.name, user.surname);
});

async function setPaid(userId, name, surname) {
  try {
    const res = await fetch(`${BASE_URL}/payments/paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name, surname }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to mark as paid");

    const user = users.find(u => u.id === userId);
    if (user) {
      user.isPaid = true;
      user.paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
    }

    renderTable();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

async function setUnpaid(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return alert("User not found");

  try {
    const res = await fetch(`${BASE_URL}/payments/unpaid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name: user.name, surname: user.surname }),
    });

    const data = await res.json();
    if (!res.ok || !data.unpaidAt) throw new Error(data.error || "Failed to mark as unpaid");

    user.isPaid = false;
    user.paidAt = null;

    renderTable();
  } catch (err) {
    console.error("Unpaid error:", err);
    alert(err.message);
  }
}

function closeHistoryModal() {
  document.getElementById("historyModal").style.display = "none";
}

async function viewPaymentHistory(userId) {
  try {
    const resPayments = await fetch(`${BASE_URL}/payments`);
    if (!resPayments.ok) throw new Error("Failed to load payment history");

    const paymentsData = await resPayments.json();
    const userPayments = paymentsData[userId]?.history || [];

    const tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML = "";

    const paidRecords = userPayments
  .filter((p) => p.status === "paid")
  .map((p) => ({
    name: p.name || "-",
    surname: p.surname || "-",
    date:
      p.date?.toDate
        ? p.date.toDate()
        : p.date || null,
  }))
  .sort((a, b) => a.date - b.date);

    if (paidRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">No payment history</td></tr>`;
    } else {
      paidRecords.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.surname}</td>
          <td>${item.name}</td>
          <td>${formatDate(item.date)}</td>
        `;
        tbody.prepend(tr);
      });
    }

    document.getElementById("historyModal").style.display = "flex";
  } catch (err) {
    console.error(err);
    alert("Failed to load payment history");
  }
}

function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d)) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

async function sendMessage() {
  const text = document.getElementById("messageText").value.trim();
  if (!text) return alert("Message empty");
  if (!selectedUsers.size) return alert("Select users");

  const usersToSend = users.filter((u) => selectedUsers.has(u.id));
  try {
    for (const u of usersToSend) {
      await fetch(API_ATTENDANCE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          message: `Assalomu alaykum, hurmatli ${u.name || ""} ${
            u.surname || ""
          }!
          
Здравствуйте, уважаемый(ая) ${u.name || ""} ${u.surname || ""}!\n\n${text}`,
        }),
      });
    }
    alert("Message sent ✅");
    document.getElementById("messageText").value = "";
    selectedUsers.clear();
    renderTable();
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}

async function sendToAll() {
  const text = document.getElementById("messageText").value.trim();
  if (!text) return alert("Message empty");
  if (!users.length) return alert("No users to send message");

  try {
    for (const u of users) {
      await fetch(API_ATTENDANCE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          message: `Assalomu alaykum, hurmatli ${u.name || ""} ${
            u.surname || ""
          }!
          
Здравствуйте, уважаемый(ая) ${u.name || ""} ${u.surname || ""}!\n\n${text}`,
        }),
      });
    }
    alert("Message sent to all ✅");
    document.getElementById("messageText").value = "";
    selectedUsers.clear();
    renderTable();
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}

function toggleSelect(id, checkbox) {
  if (checkbox.checked) selectedUsers.add(id);
  else selectedUsers.delete(id);
  renderTable();
}

function toggleSelectAll(checkbox) {
  if (checkbox.checked) users.forEach((u) => selectedUsers.add(u.id));
  else selectedUsers.clear();
  renderTable();
}

window.onload = () => {
  loadGroups();
};