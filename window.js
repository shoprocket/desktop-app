const { ipcRenderer, shell } = require('electron');
const Chart = require('chart.js/auto');
const CryptoJS = require('crypto-js');


document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    setUpNavigation();
    loadApiKey();
    listenForDisplayOrders();
}

function setUpNavigation() {
    document.getElementById('home-button').addEventListener('click', () => toggleSection('home'));
    document.getElementById('orders-button').addEventListener('click', () => toggleSection('orders'));
    document.getElementById('settings-button').addEventListener('click', () => toggleSection('settings'));
    document.getElementById('exit-button').addEventListener('click', () => {
        ipcRenderer.send('close-app');
    });
}

function toggleSection(section) {
    ['home', 'settings', 'orders'].forEach(id => {
        document.getElementById(`${id}-section`).style.display = id === section ? 'block' : 'none';
    });
}

ipcRenderer.on('show-settings', () => {
    console.log("show settings");
    toggleSection('settings');
  });


function loadApiKey() {
    ipcRenderer.invoke('get-api-key').then(savedApiKey => {
        if (savedApiKey) {
            document.getElementById('api-key').value = savedApiKey;
            // No call to 'get-orders' here. It will be handled by main.js.
        }
    });
}

function listenForDisplayOrders() {
    ipcRenderer.on('display-orders', (event, orders) => {
        console.log('Received orders:', orders);
        displayOrders(orders);
    });
}

// Listen for the 'store-details' event
ipcRenderer.on('store-details', (event, data) => {
    console.log('Received store details:', data);
    document.querySelector('.store-name .name').innerHTML = data.store_name;
    document.querySelector('.store-logo').src = "https://img.shoprocket.io/cdn-cgi/image/fit=cover,quality=75,w=70,h=70/" + data.store_logo;
    // Update other elements as needed
  });

// Function to create an MD5 hash of a string
function md5(str) {
    // Use a library like CryptoJS to generate the MD5 hash
    return CryptoJS.MD5(str.toLowerCase().trim()).toString();
}
// Function to display orders
function displayOrders(orders) {
    const orderList = document.getElementById('order-list');
    let content = '';

    orders.data.forEach(order => {
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


function openOrder(orderId) {
    const url = `https://shoprocket.io/dashboard/orders/view/${orderId}`;
    shell.openExternal(url);
}

// generic external link opener
document.addEventListener('click', (event) => {
    const target = event.target;
    
    // Check if the clicked element is an anchor tag
    if (target.tagName === 'A' && target.href) {
      // Prevent the default browser action
      event.preventDefault();
      
      // Open the link in the default browser
      shell.openExternal(target.href);
    }
  });


google.charts.load('current', { packages: ['corechart'] });
google.charts.setOnLoadCallback(drawChart);

function drawChart() {
  var data = new google.visualization.DataTable();
  data.addColumn('date', 'Date');
  data.addColumn('number', 'Revenue');
  data.addColumn('number', 'Orders');

  // Example data from API (replace with actual data)
  var apiData = [
    { date: '2023-08-01', revenue: 1200, orders: 250 },
    { date: '2023-08-02', revenue: 1000, orders: 210 },
    { date: '2023-08-03', revenue: 1500, orders: 300 },
    { date: '2023-08-04', revenue: 1100, orders: 220 },
    { date: '2023-08-05', revenue: 1300, orders: 240 },
    { date: '2023-08-06', revenue: 900,  orders: 200 },
    { date: '2023-08-07', revenue: 1600, orders: 310 },
    { date: '2023-08-08', revenue: 1400, orders: 280 },
    { date: '2023-08-09', revenue: 1000, orders: 210 },
    { date: '2023-08-10', revenue: 1100, orders: 220 },
    { date: '2023-08-11', revenue: 1200, orders: 230 },
    { date: '2023-08-12', revenue: 1300, orders: 250 },
    { date: '2023-08-13', revenue: 900,  orders: 190 },
    { date: '2023-08-14', revenue: 1500, orders: 300 },
    { date: '2023-08-15', revenue: 1400, orders: 290 },
    { date: '2023-08-16', revenue: 1300, orders: 270 },
    { date: '2023-08-17', revenue: 1200, orders: 260 },
    { date: '2023-08-18', revenue: 1100, orders: 240 }      
  ];

  // Convert the date strings to Date objects and add to the data table
  apiData.forEach(row => {
    var [year, month, day] = row.date.split('-').map(Number);
    data.addRow([new Date(year, month - 1, day), row.revenue, row.orders]);
  });

  // Create a number formatter for currency
  var formatter = new google.visualization.NumberFormat({
    pattern: '$#,###'
  });

  // Apply the formatter to the second column (Daily Revenue)
  formatter.format(data, 1);

  // Set chart options
  var options = {
    curveType: 'function',
    chartArea: {width: '80%'},
    legend: {position: 'bottom'},
    tooltip: {
        // trigger: 'selection',
        textStyle: {
            fontSize: 15 // Adjust as needed
        }
    },
    vAxis: {
        format: 'short',
        viewWindow: {min:0},
        gridlines: {color: '#ececec'}
    },
    hAxis: {
        format: 'd MMM',
        gridlines: {color: 'none'}
    },
    animation:{
        startup: true,
        easing: 'out',
        duration: 2000
    }
};

  // Instantiate and draw the chart
  var chart = new google.visualization.LineChart(document.getElementById('linechart'));
  chart.draw(data, options);
}



function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
  
    if (diffInSeconds < 60) return 'a few seconds ago';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}


document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const apiKey = document.getElementById('api-key').value;
    ipcRenderer.invoke('set-api-key', apiKey).then((response) => {
        console.log("save");
        console.log(response); // You should see "API Key saved successfully!" in the console
        
        // Display the success message
        var saveMessage = document.getElementById('save-message');
        saveMessage.style.display = 'block';
        saveMessage.classList.remove('fade-out'); // In case it has the fade-out class from previous fade

        // Trigger the fade-out effect after 3 seconds
        setTimeout(function() {
            saveMessage.classList.add('fade-out');
        }, 3000);

        // Hide the success message after the fade-out is completed
        setTimeout(function() {
            saveMessage.style.display = 'none';
            saveMessage.classList.remove('fade-out'); // Reset for next time
        }, 3500);
        
    });
  });
  