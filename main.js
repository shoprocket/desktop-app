// Modules
const {
  app,
  BrowserWindow,
  Tray,
  nativeImage,
  ipcMain,
  screen,
  Notification,
} = require("electron");
const { version } = require("./package.json");
const Store = require("electron-store");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const AutoLaunch = require("auto-launch");

// UTILS
const { GLOBAL_VARIABLE, MESSAGES } = require("./utils/constants");
const { initSentry, captureLog } = require("./utils/common-functions");

// SERVICES
const { fetchOrders } = require("./providers/order");
const { fetchStats } = require("./providers/dashboard");
const { fetchStoreDetails, fetchSubscription } = require("./providers/store");

// Constants and Initializations
const store = new Store();
const autoLaunch = new AutoLaunch({
  name: "Shoprocket",
});

GLOBAL_VARIABLE.API_KEY = store.get("apiKey");
initSentry();

// Load the user's preferences from storage when the app starts
// If the preferences are not found in the store, they default to true, enabling notifications and auto-launch by default
let notificationsEnabled = store.get("notificationsEnabled", true);
let autoLaunchEnabled = store.get("autoLaunch", true);

// Code to apply auto-launch setting on app start
autoLaunch.isEnabled().then((isEnabled) => {
  if (autoLaunchEnabled && !isEnabled) autoLaunch.enable();
  else if (!autoLaunchEnabled && isEnabled) autoLaunch.disable();
});

// Tray Variables
let mainWindow;
let tray = null;

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
  //     captureLog({method: 'message', message: 'Checking for update...'});
  // });

  // autoUpdater.on('update-not-available', (info) => {
  //     console.log('Update not available', info);
  //     captureLog({method: 'message', message: 'Update not available'});
  // });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("Update downloaded", info);
    captureLog({ method: "message", message: "Update downloaded" });
    // Silently restart and install the update
    autoUpdater.quitAndInstall();
  });

  autoUpdater.on("error", (err) => {
    console.log("Error fetching updates", err);
    captureLog({ method: "message", message: "Error fetching updates" });
    captureLog({ method: "error", error: err });
  });
}

// Function to create Tray Icon
function createTray() {
  let iconName;
  if (process.platform === "win32") {
    iconName = "icon.ico";
  } else {
    const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
    iconName = scaleFactor > 1 ? "iconTemplate@2x.png" : "iconTemplate.png";
  }

  const iconPath = path.join(__dirname, "assets", iconName);
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  tray.on("click", () => {
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
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Check if a specific command-line argument (e.g., '--dev') is provided
  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools({ mode: "bottom" });
  }

  // mainWindow.webContents.openDevTools({ mode: 'undocked' });

  mainWindow.loadFile("window.html");
  mainWindow.on("blur", () => mainWindow.hide());
}

function positionMainWindow() {
  if (process.platform === "win32") {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow.setPosition(
      width - mainWindow.getBounds().width,
      height - mainWindow.getBounds().height
    );
  } else {
    const trayBounds = tray.getBounds();
    const newY =
      process.platform === "darwin"
        ? trayBounds.y
        : trayBounds.y + trayBounds.height;
    const newX = Math.round(trayBounds.x - trayBounds.width / 2);
    const windowBounds = mainWindow.getBounds();

    mainWindow.setBounds({
      x: newX,
      y: newY,
      width: windowBounds.width,
      height: windowBounds.height,
    });
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

let previousStats = null;
let previousFirstOrderId = null;

async function loadData() {
  console.log("Loading data...");
  if (!GLOBAL_VARIABLE.API_KEY || GLOBAL_VARIABLE.API_KEY.trim() === "") {
    console.log("API key is not set. Showing settings window...");
    mainWindow.webContents.send("show-settings");

    return;
  }

  const storeDetails = await fetchStoreDetails();
  const subscription = await fetchSubscription();
  mainWindow.webContents.send("store-details", {
    storeDetails,
    subscription,
  });

  // Initial fetch for stats and orders
  const stats = await fetchStats();
  if (stats?.status === 200) {
    previousStats = stats.data.stats.revenue; // Store the initial revenue
    updateStats(stats);
  }

  const orders = await fetchOrders();
  if (orders?.status === 200 && orders?.data?.length) {
    previousFirstOrderId = orders.data[0].order_id; // Store the initial first order_id
    updateOrders(orders);
  }

  // Set an interval to refetch stats every 10 seconds
  setInterval(async () => {
    const stats = await fetchStats();
    if (
      stats?.status === 200 &&
      stats?.data?.stats?.revenue !== previousStats
    ) {
      previousStats = stats.data.stats.revenue;
      updateStats(stats);
    }
  }, 10 * 1000);

  // Set an interval to refetch orders every 10 seconds
  setInterval(async () => {
    const orders = await fetchOrders();
    if (
      orders?.status === 200 &&
      orders?.data?.length &&
      orders?.data?.[0]?.order_id !== previousFirstOrderId
    ) {
      previousFirstOrderId = orders.data[0].order_id;
      if (notificationsEnabled) {
        // Only show the notification if enabled
        notifyNewOrder();
      }
      updateOrders(orders);
    }
  }, 10 * 1000);
}

// Function to update the stats
function updateStats(stats) {
  tray.setTitle(`  ${stats.data.stats.revenue}`);
  mainWindow.webContents.send("draw-chart", stats.data.graphs.sales);
  mainWindow.webContents.send("display-stats", stats);
}

// Function to update the orders
function updateOrders(orders) {
  mainWindow.webContents.send("display-orders", orders);
}

// Function to notify a new order
function notifyNewOrder() {
  let iconPath;
  if (process.platform === "darwin") {
    // macOS
    iconPath = path.join(__dirname, "assets/icons/mac/icon.icns");
  } else {
    // Windows and other platforms
    iconPath = path.join(__dirname, "assets/icons/windows/icon.ico");
  }

  const notification = {
    title: "New Order Received!",
    body: "Click here to view details.",
    // Optional: Include an icon or image
    icon: iconPath,
  };

  const notify = new Notification(notification);
  notify.show();

  notify.on("click", () => {
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
  app.on(
    "window-all-closed",
    () => process.platform !== "darwin" && app.quit()
  );
  app.on(
    "activate",
    () => BrowserWindow.getAllWindows().length === 0 && createWindow()
  );
}

// IPC Handlers
function handleIpcEvents() {
  ipcMain.on("close-app", () => {
    app.quit();
  });

  ipcMain.handle("get-api-key", (event) => {
    return store.get("apiKey");
  });

  ipcMain.handle("set-api-key", (event, newApiKey) => {
    GLOBAL_VARIABLE.API_KEY = newApiKey; // Update the apiKey variable
    store.set("apiKey", newApiKey); // Save the new API key to the store
    loadData(); // Reload data after API key is updated
    return MESSAGES.API_KEY_SAVE_SUCCESS;
  });

  // Handlers to return the current settings
  ipcMain.handle("get-notifications-toggle", () => {
    return notificationsEnabled;
  });

  ipcMain.handle("get-auto-start-toggle", () => {
    return autoLaunchEnabled;
  });

  // Handlers to update the settings
  ipcMain.handle("set-notifications-toggle", (event, isEnabled) => {
    notificationsEnabled = isEnabled;
    store.set("notificationsEnabled", isEnabled);
  });

  // Listen for changes to the auto-start setting
  ipcMain.handle("set-auto-start-toggle", (event, isEnabled) => {
    autoLaunchEnabled = isEnabled;
    store.set("autoLaunch", isEnabled);

    autoLaunch.isEnabled().then((isCurrentlyEnabled) => {
      if (isEnabled && !isCurrentlyEnabled) {
        autoLaunch.enable();
      } else if (!isEnabled && isCurrentlyEnabled) {
        autoLaunch.disable();
      }
    });
  });

  ipcMain.handle("get-orders", async (event) => {
    console.log("Fetching orders...");
    try {
      const orders = await fetchOrders(); // Fetch orders

      // Emit the 'display-orders' event to the renderer process
      mainWindow.webContents.send("display-orders", orders);
      return orders;
    } catch (error) {
      // Send a specific error message to the renderer process
      event.sender.send("get-orders-error", MESSAGES.ORDER_FAILURE);
      return []; // Return an empty array if there's an error
    }
  });
}

// Main entry point
app.whenReady().then(() => {
  console.log(MESSAGES.APP_READY);
  if (process.platform === "darwin") {
    // Check if the app is running on macOS
    app.dock.hide(); // Hide the dock icon
  }

  setUpAutoUpdater();
  handleAppLifecycleEvents();
  handleIpcEvents();
  createTray();
  createWindow();

  mainWindow.webContents.on("did-finish-load", () => {
    loadData();
    mainWindow.webContents.send("app-version", version);
  });
});
