// Modules
const { app, BrowserWindow, Tray, nativeImage, ipcMain, screen, Notification } = require('electron');
const { version } = require('./package.json');
const Store = require('electron-store');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const { init, captureMessage, captureException } = require('@sentry/electron');
const axios = require('axios');
const AutoLaunch = require('auto-launch');

// Constants and Initializations
const store = new Store();
const autoLaunch = new AutoLaunch({
    name: 'Shoprocket',
});


initSentry();

// api key
let apiKey = store.get('apiKey');

// Load the user's preferences from storage when the app starts
// If the preferences are not found in the store, they default to true, enabling notifications and auto-launch by default
let notificationsEnabled = store.get('notificationsEnabled', true);
let autoLaunchEnabled = store.get('autoLaunch', true);


// Code to apply auto-launch setting on app start
autoLaunch.isEnabled().then((isEnabled) => {
    if (autoLaunchEnabled && !isEnabled) autoLaunch.enable();
    else if (!autoLaunchEnabled && isEnabled) autoLaunch.disable();
});

// Tray Variables
let mainWindow;
let tray = null;

// Sentry Initialization
function initSentry() {
    init({
        dsn: "https://da46f9ed305c995d63364f3cc626ae3f@o925826.ingest.sentry.io/4505726470979584",
    });
    captureMessage("Shoprocket app started");
}





// Auto Updater Functionality
function setUpAutoUpdater() {
    // Check for updates immediately
    autoUpdater.checkForUpdates();

    // Set up a periodic check every 5 minutes
    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, 300000); // 300,000 milliseconds = 5 minutes

    // autoUpdater.on('update-available', () => {
    //     // Notify user that an update is available (optional, can be removed for silent update)
    //     dialog.showMessageBox({
    //         type: 'info',
    //         title: 'Update Available',
    //         message: 'A new version of the Shoprocket app is available. It will be downloaded in the background.',
    //     });
    // });

    // autoUpdater.on('checking-for-update', () => {
    //     console.log('Checking for update...');
    //     captureMessage('Checking for update...');
    // });
    
    // autoUpdater.on('update-not-available', (info) => {
    //     console.log('Update not available', info);
    //     captureMessage('Update not available');
    // });
    
    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded', info);
        captureMessage('Update downloaded');
        // Silently restart and install the update
        autoUpdater.quitAndInstall();
    });
    
    autoUpdater.on('error', (err) => {
        console.log('Error fetching updates', err);
        captureMessage('Error fetching updates');
        captureException(err);
    });
}

// Function to create Tray Icon
function createTray() {
    let iconName;
    if (process.platform === 'win32') {
        iconName = 'icon.ico';
    } else {
        const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
        iconName = scaleFactor > 1 ? 'iconTemplate@2x.png' : 'iconTemplate.png';
    }

    const iconPath = path.join(__dirname, 'assets', iconName);
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon);

    tray.on('click', () => {
        positionMainWindow();
    });
}

// Function to create the main Browser Window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 630,
        show: false,
        frame: false,
        resizable: true ,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Check if a specific command-line argument (e.g., '--dev') is provided
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools({ mode: 'bottom' });
    }

    // mainWindow.webContents.openDevTools({ mode: 'undocked' });
      

    mainWindow.loadFile('window.html');
    mainWindow.on('blur', () => mainWindow.hide());
}


function positionMainWindow() {
    if (process.platform === 'win32') {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        mainWindow.setPosition(width - mainWindow.getBounds().width, height - mainWindow.getBounds().height);
    } else {
        const trayBounds = tray.getBounds();
        const newY = process.platform === 'darwin' ? trayBounds.y : trayBounds.y + trayBounds.height;
        const newX = Math.round(trayBounds.x - trayBounds.width / 2);
        const windowBounds = mainWindow.getBounds();

        mainWindow.setBounds({
            x: newX,
            y: newY,
            width: windowBounds.width,
            height: windowBounds.height
        });
    }

    if (mainWindow.isVisible()) {
        mainWindow.hide();
    } else {
        mainWindow.show();
        mainWindow.focus();
    }
}

// Async function to fetch store details
async function fetchStoreDetails() {
    const storeDetailsUrl = 'https://api.shoprocket.io/v1/store/details';

    try {
        const response = await axios.get(storeDetailsUrl, {
        headers: {
            'x-api-key': apiKey // Make sure this matches the correct API key variable
        }
        });

        return response.data;


    } catch (error) {
        // Handle Axios-specific error details
        if (error.response) {
            console.error(`Error fetching store details: ${error.response.status} - ${error.response.statusText}`);
            captureException(new Error(`${error.response.status} - ${error.response.statusText}`)); // Send the error to Sentry
        } else {
            console.error('Error fetching store details:', error);
            captureException(error); // Send the error to Sentry
        }
    }
}


async function fetchOrders() {
    // Check if API key is set
    if (!apiKey) {
        console.error('API key is not set. Please set the API key before fetching orders.');
        return [];
    }

    // Define API URL and headers
    const apiUrl = 'https://api.shoprocket.io/v1/orders?limit=100&page=0';
    const headers = {
        'x-api-key': apiKey
    };

    try {
        // Make the API request using Axios
        const response = await axios.get(apiUrl, { headers });

        return response.data; // Axios automatically parses the JSON response
    } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
    }
}

// Define the function to fetch stats
async function fetchStats(from, to) {
    // Default to the last 7 days if dates are not provided
    if (!from || !to) {
    from = new Date();
    from.setDate(from.getDate() - 7);
    to = new Date();
    }

    const apiUrl = `https://api.shoprocket.io/v1/store/stats?from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`;

    try {
    const response = await axios.get(apiUrl, {
        headers: {
        'x-api-key': apiKey
        }
    });

    const { data } = response;
    // console.log('Store stats:', data);
    console.log('Store stats:', data);

    return response.data; // Return the entire data object

    } catch (error) {
        console.error('Error fetching store stats:', error);
        captureException(error); // Send the error to Sentry if needed
    }
}


// Define the function to fetch stats
async function fetchSubscription() {
    
    const apiUrl = `https://api.shoprocket.io/v1/subscription`;

    try {
    const response = await axios.get(apiUrl, {
        headers: {
        'x-api-key': apiKey
        }
    });

    const { data } = response;

    console.log('Store subscription:', data);

    return response.data; // Return the entire data object

    } catch (error) {
        console.error('Error fetching store subscription:', error);
        captureException(error); // Send the error to Sentry if needed
    }
}
let previousStats = null;
let previousFirstOrderId = null;

async function loadData() {
  console.log("Loading data...");
  if (!apiKey || apiKey.trim() === '') {
    console.log('API key is not set. Showing settings window...');
    mainWindow.webContents.send('show-settings');
  } else {
    const storeDetails = await fetchStoreDetails();
    const subscription = await fetchSubscription();
    mainWindow.webContents.send('store-details', { storeDetails, subscription });

    // Initial fetch for stats and orders
    const stats = await fetchStats();
    if (stats.status === 200) {
      previousStats = stats.data.stats.revenue; // Store the initial revenue
      updateStats(stats);
    }

    const orders = await fetchOrders();
    if (orders.status === 200 && orders.data.length > 0) {
      previousFirstOrderId = orders.data[0].order_id; // Store the initial first order_id
      updateOrders(orders);
    }

    // Set an interval to refetch stats every 10 seconds
    setInterval(async () => {
      const stats = await fetchStats();
      if (stats.status === 200 && stats.data.stats.revenue !== previousStats) {
        previousStats = stats.data.stats.revenue;
        updateStats(stats);
      }
    }, 10 * 1000);
    
    // Set an interval to refetch orders every 10 seconds
    setInterval(async () => {
      const orders = await fetchOrders();
      if (orders.status === 200 && orders.data.length > 0 && orders.data[0].order_id !== previousFirstOrderId) {
        previousFirstOrderId = orders.data[0].order_id;
        if (notificationsEnabled) { // Only show the notification if enabled
            notifyNewOrder();
        }
        updateOrders(orders);
      }
    }, 10 * 1000);
  }
}

// Function to update the stats
function updateStats(stats) {
  tray.setTitle(`  ${stats.data.stats.revenue}`);
  mainWindow.webContents.send('draw-chart', stats.data.graphs.sales);
  mainWindow.webContents.send('display-stats', stats);
}

// Function to update the orders
function updateOrders(orders) {
    mainWindow.webContents.send('display-orders', orders);
}


// Function to notify a new order
function notifyNewOrder() {
    let iconPath;
    if (process.platform === 'darwin') { // macOS
        iconPath = path.join(__dirname, 'assets/icons/mac/icon.icns');
    } else { // Windows and other platforms
        iconPath = path.join(__dirname, 'assets/icons/windows/icon.ico');
    }

    
    const notification = {
      title: 'New Order Received!',
      body: 'Click here to view details.',
      // Optional: Include an icon or image
      icon: iconPath
    };
  
    const notify = new Notification(notification);
    notify.show();

    notify.on('click', () => {
        if (mainWindow) {
            positionMainWindow();
            if (mainWindow.isMinimized()) mainWindow.restore(); // Restore if minimized
            mainWindow.show();
            mainWindow.focus(); // Focus the window
        } else {
            console.log("mainWindow is not defined at the time of the click");
        }
    });
}
    

  

// App Lifecycle Events
function handleAppLifecycleEvents() {
    app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
    app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
}

// IPC Handlers
function handleIpcEvents() {
    
    ipcMain.on('close-app', () => {
        app.quit();
    });
    
    ipcMain.handle('get-api-key', (event) => {
        return store.get('apiKey');
    });
    
    ipcMain.handle('set-api-key', (event, newApiKey) => {
        apiKey = newApiKey; // Update the apiKey variable
        store.set('apiKey', newApiKey); // Save the new API key to the store
        loadData(); // Reload data after API key is updated
        return 'API Key saved successfully!';
    });

    // Handlers to return the current settings
    ipcMain.handle('get-notifications-toggle', () => {
        return notificationsEnabled;
    });

    ipcMain.handle('get-auto-start-toggle', () => {
        return autoLaunchEnabled;
    }); 

    // Handlers to update the settings
    ipcMain.handle('set-notifications-toggle', (event, isEnabled) => {
        notificationsEnabled = isEnabled;
        store.set('notificationsEnabled', isEnabled);
    });

    // Listen for changes to the auto-start setting
    ipcMain.handle('set-auto-start-toggle', (event, isEnabled) => {
        autoLaunchEnabled = isEnabled;
        store.set('autoLaunch', isEnabled);
    
        autoLaunch.isEnabled().then((isCurrentlyEnabled) => {
            if (isEnabled && !isCurrentlyEnabled) {
                autoLaunch.enable();
            } else if (!isEnabled && isCurrentlyEnabled) {
                autoLaunch.disable();
            }
        });
    });

    
    ipcMain.handle('get-orders', async (event) => {
        console.log('Fetching orders...');
        try {
            const orders = await fetchOrders(); // Fetch orders
            console.log('Orders:', orders);
            // Emit the 'display-orders' event to the renderer process
            mainWindow.webContents.send('display-orders', orders);
            return orders;
        } catch (error) {
            console.error(error);
            // Send a specific error message to the renderer process
            event.sender.send('get-orders-error', 'An error occurred while fetching orders. Please try again later.');
            return []; // Return an empty array if there's an error
        }
    });

}

// Main entry point
app.whenReady().then(() => {
    console.log('App is ready!');
    if (process.platform === 'darwin') { // Check if the app is running on macOS
        app.dock.hide(); // Hide the dock icon
    }
    setUpAutoUpdater();
    handleAppLifecycleEvents();
    handleIpcEvents();
    createTray();
    createWindow();
    
    mainWindow.webContents.on('did-finish-load', () => {
        loadData();
        mainWindow.webContents.send('app-version', version);
    });

});