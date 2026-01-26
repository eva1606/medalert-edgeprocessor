const measurementHistory = [];
const alertHistory = [];

function $(id) {
  return document.getElementById(id);
}

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts || "—";
  }
}

function setStatusPill(online) {
  const pill = $("statusPill");
  if (!pill) return;

  if (online) {
    pill.textContent = "ONLINE";
    pill.classList.remove("offline");
    pill.classList.add("online");
  } else {
    pill.textContent = "OFFLINE";
    pill.classList.remove("online");
    pill.classList.add("offline");
  }
}

function toast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  setTimeout(() => {
    if (t.textContent === msg) t.textContent = "";
  }, 2000);
}

function renderMeasurementsTable() {
  const tbody = document.querySelector("#measurementsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  for (const m of measurementHistory) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmt(m.timestamp)}</td>
      <td>${m.measurementType || "—"}</td>
      <td>${m.value ?? "—"}</td>
      <td>${m.signalQuality ?? "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderAlertsTable() {
  const tbody = document.querySelector("#alertsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  for (const a of alertHistory) {
    const sev = a.severityLevel || "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmt(a.timestamp)}</td>
      <td>${a.patientId || "—"}</td>
      <td>${a.alertType || "—"}</td>
      <td class="sev-${sev}">${sev}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderAllTables() {
  renderMeasurementsTable();
  renderAlertsTable();
}

async function loadHistoryFromServer() {
  const patientId = $("patientId")?.value?.trim() || "p1";
  const res = await fetch(`/history?patientId=${encodeURIComponent(patientId)}`);
  const h = await res.json();

  if (!h.ok) return;

  measurementHistory.length = 0;
  alertHistory.length = 0;

  // server returns most recent first (based on repository), keep 10
  measurementHistory.push(...(h.measurements || []).slice(0, 10));
  alertHistory.push(...(h.alerts || []).slice(0, 10));

  renderAllTables();
}

async function refresh() {
  const patientId = $("patientId")?.value?.trim() || "p1";
  const res = await fetch(`/status?patientId=${encodeURIComponent(patientId)}`);
  const data = await res.json();

  setStatusPill(!!data.online);

  const m = data.measurements || {};
  $("hr").textContent = m.HEART_RATE?.value ?? "—";
  $("spo2").textContent = m.SPO2?.value ?? "—";
  $("temp").textContent = m.TEMPERATURE?.value ?? "—";
}

async function ingest() {
  const patientId = $("patientId").value.trim();
  const measurementType = $("type").value;
  const value = Number($("value").value);
  const signalQuality = Number($("signalQuality").value);

  const res = await fetch("/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patientId, measurementType, value, signalQuality })
  });

  const out = await res.json();

  if (!out.ok) {
    toast(`❌ Error: ${out.error || "ingest failed"}`);
    return;
  }

  // update history (UI)
  if (out.measurement) {
    measurementHistory.unshift(out.measurement);
    if (measurementHistory.length > 10) measurementHistory.pop();
  }

  // if alert was produced, push to alert history
  if (out.result?.alert) {
    alertHistory.unshift(out.result.alert);
    if (alertHistory.length > 10) alertHistory.pop();
    toast(`⚠️ ALERT ${out.result.alert.severityLevel}: ${out.result.alert.alertType}`);
  } else {
    toast("✅ Measurement sent");
  }

  renderAllTables();
  refresh();
}

async function setOnline(flag) {
  const res = await fetch("/online", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ online: flag })
  });

  const out = await res.json();

  if (out.ok) {
    toast(flag ? "✅ Online" : "✅ Offline");
    refresh();
  } else {
    toast(`❌ Error: ${out.error || "online toggle failed"}`);
  }
}

async function flush() {
  const res = await fetch("/flush", { method: "POST" });
  const out = await res.json();

  if (out.ok) {
    toast("✅ Flush done");
  } else {
    toast(`❌ Error: ${out.error || "flush failed"}`);
  }
}

$("sendBtn")?.addEventListener("click", ingest);
$("goOnlineBtn")?.addEventListener("click", () => setOnline(true));
$("goOfflineBtn")?.addEventListener("click", () => setOnline(false));
$("flushBtn")?.addEventListener("click", flush);

// if patientId changes, reload persisted history for that patient
$("patientId")?.addEventListener("change", loadHistoryFromServer);

loadHistoryFromServer();
setInterval(refresh, 2000);
refresh();
