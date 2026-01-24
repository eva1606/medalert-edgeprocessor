async function fetchData() {
  const res = await fetch("http://localhost:3000/status");
  const data = await res.json();

  document.getElementById("status").textContent = data.online ? "ONLINE" : "OFFLINE";

  document.getElementById("hr").textContent = data.measurements.HEART_RATE ?? "--";
  document.getElementById("spo2").textContent = data.measurements.SPO2 ?? "--";
  document.getElementById("temp").textContent = data.measurements.TEMPERATURE ?? "--";

  const alertsList = document.getElementById("alerts");
  alertsList.innerHTML = "";

  data.alerts.forEach(a => {
    const li = document.createElement("li");
    li.textContent = `[${a.severityLevel}] ${a.alertType}`;
    li.className = "alert";
    alertsList.appendChild(li);
  });
}

setInterval(fetchData, 1000);
