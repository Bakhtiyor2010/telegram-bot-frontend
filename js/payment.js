const BASE_URL = "https://fayzullaev-ielts-school-backend.onrender.com/api";

const API_USERS = `${BASE_URL}/users`;
const API_GROUPS = `${BASE_URL}/groups`;
const API_ATTENDANCE = `${BASE_URL}/attendance`;

let users = [];
let selectedUsers = new Set();
let groups = [];
let paymentsByUserMonth = {};
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
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No users to show</td></tr>`;
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

  tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;font-size:20px;">Loading...</td></tr>`;

  let paymentsData = {};

  try {
    const resUsers = await fetch(API_USERS);
    if (!resUsers.ok) throw new Error("Failed to load users");
    const usersData = await resUsers.json();

    try {
      const resPayments = await fetch(`${BASE_URL}/payments`);
      if (!resPayments.ok) throw new Error("Failed to load payments");
      paymentsData = await resPayments.json();

      paymentsByUserMonth = {};

      for (const userId in paymentsData) {
        const payment = paymentsData[userId];
        if (!payment || !payment.history) continue;

        paymentsByUserMonth[userId] = {};

        payment.history.forEach((h) => {
          if (!h.monthKey) return;

          paymentsByUserMonth[userId][h.monthKey] = h.status;
          paymentsByUserMonth[userId][h.monthKey + "_date"] = h.date
            ? new Date(h.date)
            : null;
        });
      }
    } catch (err) {
      console.warn("Payments not loaded:", err.message);
    }

    users = usersData
      .map((u) => {
        const payment = paymentsData[u.id] || {};
        const lastPaid =
          payment.history && payment.history.length
            ? payment.history
                .filter((h) => h.status === "paid" && h.date)
                .map((h) => ({ ...h, date: new Date(h.date) }))
                .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
            : null;

        return {
          ...u,
          id: u.id || u._id,
          isPaid: !!lastPaid,
          paidAt: lastPaid ? lastPaid.date : null,
        };
      })
      .filter((u) => u.groupId && u.groupId === currentGroupId);

    users.sort((a, b) => (a.isPaid === b.isPaid ? 0 : a.isPaid ? 1 : -1));

    renderTable();
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red">Failed to load users</td></tr>`;
  }
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function generateMonthSelect(select) {
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select month";
  defaultOption.selected = true;
  defaultOption.disabled = true;
  select.appendChild(defaultOption);

  monthNames.forEach((m) => {
    const option = document.createElement("option");
    option.value = m;
    option.textContent = m;
    select.appendChild(option);
  });
}

function generateYearSelect(select) {
  select.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Select year";
  defaultOption.selected = true;
  defaultOption.disabled = true;
  select.appendChild(defaultOption);

  const now = new Date();
  const currentYear = now.getFullYear();
  for (let y = currentYear - 3; y <= currentYear + 2; y++) {
    const option = document.createElement("option");
    option.value = y;
    option.textContent = y;
    select.appendChild(option);
  }
}

function renderTable() {
  tableBody.innerHTML = "";
  if (!users.length) {
    tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center">No users in this group</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  users.forEach((u, index) => {
    const tr = document.createElement("tr");
    tr.dataset.userid = u.id;

    const phone = u.phone
      ? u.phone.startsWith("+998")
        ? u.phone
        : "+998" + u.phone
      : "N/A";

    tr.innerHTML = `
      <td><input type="checkbox" ${selectedUsers.has(u.id) ? "checked" : ""} onchange="toggleSelect('${u.id}', this)"></td>
      <td>${index + 1}</td>
      <td>${u.surname || "-"}</td>
      <td>${u.name || "-"}</td>
      <td><a href="tel:${phone}">${phone}</a></td>
      <td><select class="rowMonth"></select></td>
      <td><select class="rowYear"></select></td>
      <td>
        <button class="paid-btn" style="background:#28a745;" data-id="${u.id}"><i class="fa-solid fa-circle-check"></i></button>
        <button class="unpaid-btn" style="background:#dc3545;" data-id="${u.id}"><i class="fa-solid fa-circle-xmark"></i></button>
        <button style="background:#ffc107;" onclick="viewPaymentHistory('${u.id}')"><i class="fa-solid fa-clock-rotate-left"></i></button>
      </td>
      <td class="status-cell">—</td>
    `;

    fragment.appendChild(tr);

    const monthSelect = tr.querySelector(".rowMonth");
    const yearSelect = tr.querySelector(".rowYear");
    const statusCell = tr.querySelector(".status-cell");

    generateMonthSelect(monthSelect);
    generateYearSelect(yearSelect);

    const userPayments = paymentsByUserMonth[u.id] || {};
    const paidKeys = Object.keys(userPayments).filter(
      (k) => !k.endsWith("_date") && userPayments[k] === "paid",
    );
    if (paidKeys.length) {
      const latestKey = paidKeys.sort(
        (a, b) =>
          new Date(userPayments[b + "_date"]) -
          new Date(userPayments[a + "_date"]),
      )[0];
      const latestDate = userPayments[latestKey + "_date"];
      tr.style.background = "#d4edda";
      statusCell.textContent = latestDate ? formatDate(latestDate) : "Paid";

      const [month, year] = latestKey.split("-");
      monthSelect.value = month;
      yearSelect.value = year;
    } else {
      tr.style.background = "#f8d7da";
      statusCell.textContent = "Unpaid";
    }

    function updateStatus() {
      const month = monthSelect.value;
      const year = yearSelect.value;
      if (!month || !year) {
        tr.style.background = "#fff";
        statusCell.textContent = "—";
        return;
      }
      const monthKey = `${month}-${year}`;
      const st = userPayments[monthKey];
      if (st === "paid") {
        tr.style.background = "#d4edda";
        const paidDate = userPayments[monthKey + "_date"];
        statusCell.textContent = paidDate ? formatDate(paidDate) : "Paid";
      } else {
        tr.style.background = "#f8d7da";
        statusCell.textContent = "Unpaid";
      }
    }

    monthSelect.addEventListener("change", updateStatus);
    yearSelect.addEventListener("change", updateStatus);
  });

  tableBody.appendChild(fragment);
}

tableBody.addEventListener("click", (e) => {
  const paidBtn = e.target.closest(".paid-btn");
  const unpaidBtn = e.target.closest(".unpaid-btn");
  if (!paidBtn && !unpaidBtn) return;

  const row = e.target.closest("tr");
  const monthSelect = row.querySelector(".rowMonth");
  const yearSelect = row.querySelector(".rowYear");
  const userId = (paidBtn || unpaidBtn).dataset.id;
  const user = users.find((u) => u.id === userId);
  if (!user) return;

  const month = monthSelect.value;
  const year = yearSelect.value;

  if (!month || !year) {
    return alert(
      "Please select both month and year before marking Paid/Unpaid",
    );
  }

  if (paidBtn) setPaid(user.id, user.name, user.surname, month, year);
  if (unpaidBtn) setUnpaid(user.id, month, year);
});

async function setPaid(userId, name, surname, month, year) {
  try {
    const monthKey = `${month}-${year}`;
    const res = await fetch(`${BASE_URL}/payments/paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name, surname, month, year }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (!paymentsByUserMonth[userId]) paymentsByUserMonth[userId] = {};
    paymentsByUserMonth[userId][monthKey] = "paid";
    paymentsByUserMonth[userId][monthKey + "_date"] = new Date();

    // update row only
    updateRowStatus(userId, month, year);
  } catch (err) {
    alert(err.message);
  }
}

async function setUnpaid(userId, month, year) {
  try {
    const user = users.find((u) => u.id === userId);
    const monthKey = `${month}-${year}`;
    const res = await fetch(`${BASE_URL}/payments/unpaid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        name: user.name,
        surname: user.surname,
        month,
        year,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    if (!paymentsByUserMonth[userId]) paymentsByUserMonth[userId] = {};
    paymentsByUserMonth[userId][monthKey] = "unpaid";
    paymentsByUserMonth[userId][monthKey + "_date"] = null;

    updateRowStatus(userId, month, year);
  } catch (err) {
    alert(err.message);
  }
}

function updateRowStatus(userId, month, year) {
  const row = tableBody.querySelector(`tr[data-userid='${userId}']`);
  if (!row) return;

  const monthSelect = row.querySelector(".rowMonth");
  const yearSelect = row.querySelector(".rowYear");
  const statusCell = row.querySelector(".status-cell");

  monthSelect.value = month;
  yearSelect.value = year;

  const monthKey = `${month}-${year}`;
  const st = paymentsByUserMonth[userId][monthKey];
  if (st === "paid") {
    row.style.background = "#d4edda";
    const paidDate = paymentsByUserMonth[userId][monthKey + "_date"];
    statusCell.textContent = paidDate ? formatDate(paidDate) : "Paid";
  } else {
    row.style.background = "#f8d7da";
    statusCell.textContent = "Unpaid";
  }
}

function closeHistoryModal() {
  document.getElementById("historyModal").style.display = "none";
}

async function viewPaymentHistory(userId) {
  try {
    const res = await fetch(`${BASE_URL}/payments`);
    const paymentsData = await res.json();
    const history = paymentsData[userId]?.history || [];

    const tbody = document.querySelector("#historyTable tbody");
    tbody.innerHTML = "";

    history
      .filter((item) => item.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach((item) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
      <td>${item.surname}</td>
      <td>${item.name}</td>
      <td>${item.monthKey || "No month"}</td>
      <td>${formatDate(item.date)}</td>
    `;

        tbody.prepend(tr);
      });

    document.getElementById("historyModal").style.display = "flex";
  } catch {
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
    await Promise.all(
      usersToSend.map((u) =>
        fetch(API_ATTENDANCE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: u.id,
            message: `Assalomu alaykum, hurmatli ${u.name || ""} ${u.surname || ""}!\nЗдравствуйте, уважаемый(ая) ${u.name || ""} ${u.surname || ""}!\n\n${text}`,
          }),
        }),
      ),
    );
    alert("Message sent ✅");
    document.getElementById("messageText").value = "";
    selectedUsers.clear();
    tableBody
      .querySelectorAll("tr")
      .forEach((row) => row.classList.remove("selected"));
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
    await Promise.all(
      users.map((u) =>
        fetch(API_ATTENDANCE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: u.id,
            message: `Assalomu alaykum, hurmatli ${u.name || ""} ${u.surname || ""}!\nЗдравствуйте, уважаемый(ая) ${u.name || ""} ${u.surname || ""}!\n\n${text}`,
          }),
        }),
      ),
    );
    alert("Message sent to all ✅");
    document.getElementById("messageText").value = "";
    selectedUsers.clear();
    tableBody
      .querySelectorAll("tr")
      .forEach((row) => row.classList.remove("selected"));
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}

function toggleSelect(id, checkbox) {
  if (checkbox.checked) selectedUsers.add(id);
  else selectedUsers.delete(id);

  const row = tableBody.querySelector(`tr[data-userid='${id}']`);
  if (row) row.classList.toggle("selected", checkbox.checked);
}

function toggleSelectAll(checkbox) {
  if (checkbox.checked) users.forEach((u) => selectedUsers.add(u.id));
  else selectedUsers.clear();

  tableBody.querySelectorAll("tr").forEach((row) => {
    const input = row.querySelector("input[type='checkbox']");
    if (input) {
      input.checked = checkbox.checked;
      row.classList.toggle("selected", checkbox.checked);
    }
  });
}

window.onload = () => {
  loadGroups();
};