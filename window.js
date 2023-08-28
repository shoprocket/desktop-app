const { ipcRenderer, shell } = require("electron");
const CryptoJS = require("crypto-js");
const { timeAgo, md5 } = require("./utils/common-functions");
const { GLOBAL_VARIABLE } = require("./utils/constants");

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  setUpNavigation();
  loadApiKey();
  listenForDisplayOrders();
}

function setUpNavigation() {
  [
    {
      id: "home-button",
      listener: "click",
      handler: toggleSection,
      param: "home",
    },
    {
      id: "orders-button",
      listener: "click",
      handler: toggleSection,
      param: "orders",
    },
    {
      id: "settings-button",
      listener: "click",
      handler: toggleSection,
      param: "settings",
    },
    {
      id: "exit-button",
      listener: "click",
      handler: ipcRenderer.send,
      param: "close-app",
    },
  ].forEach(({ id, listener, handler, param }) => {
    document.getElementById(id).addEventListener(listener, () => {
      handler(param);
    });
  });
}

function toggleSection(section) {
  ["home", "settings", "orders"].forEach((id) => {
    document.getElementById(`${id}-section`).style.display =
      id === section ? "block" : "none";
  });
}

function loadApiKey() {
  ipcRenderer.invoke("get-api-key").then((savedApiKey) => {
    if (savedApiKey) {
      document.getElementById("api-key").value = savedApiKey;
      // No call to 'get-orders' here. It will be handled by main.js.
    }
  });
}

function listenForDisplayOrders() {
  ipcRenderer.on("display-orders", (event, orders) => {
    console.log("Received orders:", orders);
    displayOrders(orders);
  });
}

// Function to display orders
function displayOrders(orders) {
  const orderList = document.getElementById("order-list");
  let content = "";
  if (orders.data.length > 0) {
    orders.data.forEach((order) => {
      const createdTimeAgo = timeAgo(order.created_at);
      const emailHash = md5(order.email);
      const avatarURL = `https://avatar.shoprocket.io/avatar/${emailHash}?d=identicon&s=128`;

      content += `
            <div class="order-row unread-${order.is_unread}" onclick="openOrder('${order.id}')">
                <span class="order-column id">${order.order_id}</span>
                <span class="order-column created-at">${createdTimeAgo}</span>
                <span class="order-column total-amount">${order.currency_paid_in_symbol}${order.total_amount}</span>
                <span class="order-column customer">
                    <img class='avatar mr-1' src='${avatarURL}' />
                    ${order.email}
                </span>
            </div>
            `;
    });

    orderList.innerHTML = content;
  }
}

function openOrder(orderId) {
  const url = `https://shoprocket.io/dashboard/orders/view/${orderId}`;
  shell.openExternal(url);
}

ipcRenderer.on("show-settings", () => {
  console.log("show settings");
  toggleSection("settings");
});

ipcRenderer.on("app-version", (event, version) => {
  document.querySelector(".version").textContent = "v" + version;
});

// Listen for the 'store-details' event
ipcRenderer.on("store-details", (event, data) => {
  if (data?.storeDetails)
    document.querySelector(".store-name .name").innerHTML =
      data?.storeDetails?.data?.store_name;

  document.querySelector(".store-logo").src = data?.storeDetails?.data
    ?.store_logo
    ? `${GLOBAL_VARIABLE.IMG_URL}${data?.storeDetails?.data?.store_logo}`
    : `${GLOBAL_VARIABLE.IMG_URL}store-placeholder.png`;

  if (data?.subscription)
    document.querySelector(".store-name .plan").innerHTML =
      data?.subscription?.data?.name +
      " (" +
      data?.subscription?.data?.status +
      ")";
});

// Listen for the 'display-stats' event
ipcRenderer.on("display-stats", (event, data) => {
  document.querySelector(".revenue").innerHTML = data.data.stats.revenue;
  document.querySelector(".orders").innerHTML = data.data.stats.orders;
  document.querySelector(".visits").innerHTML =
    data.data.stats.visitors.toLocaleString();
  document.querySelector(".abandoned").innerHTML = data.data.stats.abandoned;
});

// Listen for the 'draw-chart' message from the main process
ipcRenderer.on("draw-chart", (event, sales) => {
  // Call your drawChart function with the sales data
  drawChart(sales);

  const loadingElements = document.querySelectorAll(".loading");

  // Loop through the elements and remove the "loading" class
  loadingElements.forEach((element) => {
    element.classList.remove("loading");
  });
});

// generic external link opener
document.addEventListener("click", (event) => {
  const target = event.target;

  // Check if the clicked element is an anchor tag
  if (target.tagName === "A" && target.href) {
    // Prevent the default browser action
    event.preventDefault();

    // Open the link in the default browser
    shell.openExternal(target.href);
  }
});

google.charts.load("current", { packages: ["corechart"] });
google.charts.setOnLoadCallback(drawChart);

function drawChart(sales) {
  if (!sales) {
    return;
  }
  var data = new google.visualization.DataTable();
  data.addColumn("date", "Date");
  data.addColumn("number", "Revenue");
  data.addColumn("number", "Orders");

  // Process sales data from API response
  sales.forEach((sale) => {
    var [year, month, day] = sale.dt.split("-").map(Number);
    var revenue = parseFloat(sale.total_amount);
    var orders = parseInt(sale.total_orders, 10);
    data.addRow([new Date(year, month - 1, day), revenue, orders]);
  });

  // Create a number formatter for currency
  var formatter = new google.visualization.NumberFormat({
    pattern: "$#,###",
  });

  // Apply the formatter to the second column (Daily Revenue)
  formatter.format(data, 1);

  // Set chart options
  var options = {
    curveType: "function",
    chartArea: { width: "80%" },
    legend: { position: "bottom" },
    tooltip: {
      // trigger: 'selection',
      textStyle: {
        fontSize: 15, // Adjust as needed
      },
    },
    vAxis: {
      format: "short",
      viewWindow: { min: 0 },
      gridlines: { color: "#ececec" },
    },
    hAxis: {
      format: "d MMM",
      gridlines: { color: "none" },
      textPosition: "none", // This will hide the hAxis labels
      // textStyle: {
      //     fontSize: 0 // Adjust the font size as needed
      // }
    },
    animation: {
      startup: true,
      easing: "out",
      duration: 2000,
    },
  };

  // Instantiate and draw the chart
  var chart = new google.visualization.LineChart(
    document.getElementById("linechart")
  );
  chart.draw(data, options);
}

// Query the saved preferences to set initial checkbox states
ipcRenderer.invoke("get-notifications-toggle").then((isEnabled) => {
  document.getElementById("notificationsToggle").checked = isEnabled;
});

ipcRenderer.invoke("get-auto-start-toggle").then((isEnabled) => {
  document.getElementById("autoStartToggle").checked = isEnabled;
});

document.getElementById("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const apiKey = document.getElementById("api-key").value;
  const notificationsToggle = document.getElementById(
    "notificationsToggle"
  ).checked;
  const autoStartToggle = document.getElementById("autoStartToggle").checked;

  // Save the checkbox settings
  ipcRenderer.invoke("set-notifications-toggle", notificationsToggle);
  ipcRenderer.invoke("set-auto-start-toggle", autoStartToggle);

  // Check if the provided API key is different from the stored one
  ipcRenderer.invoke("get-api-key").then((savedApiKey) => {
    if (apiKey !== savedApiKey) {
      ipcRenderer.invoke("set-api-key", apiKey).then((response) => {
        displaySuccessMessage();
      });
    } else {
      displaySuccessMessage();
    }
  });
});

function displaySuccessMessage() {
  // Display the success message
  var saveMessage = document.getElementById("save-message");
  saveMessage.style.display = "block";
  saveMessage.classList.remove("fade-out"); // In case it has the fade-out class from previous fade

  // Trigger the fade-out effect after 3 seconds
  setTimeout(function () {
    saveMessage.classList.add("fade-out");
  }, 3000);

  // Hide the success message after the fade-out is completed
  setTimeout(function () {
    saveMessage.style.display = "none";
    saveMessage.classList.remove("fade-out"); // Reset for next time
  }, 3500);
}
