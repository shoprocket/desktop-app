const { app, BrowserWindow, Tray, nativeImage, ipcMain, screen } = require('electron');
const Store = require('electron-store');
const store = new Store(); // Initialize store
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const { init, captureMessage, captureException } = require('@sentry/electron');
const axios = require('axios');





init({
    dsn: "https://da46f9ed305c995d63364f3cc626ae3f@o925826.ingest.sentry.io/4505726470979584",
});

captureMessage("test");


autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-available', () => {
  // Notify the user that an update is available.
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version of the Shoprocket app is available. It will be downloaded in the background.',
  });
});

autoUpdater.on('update-downloaded', () => {
  // Notify the user that the update is ready to be installed.
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version of the Shoprocket app has been downloaded. Would you like to restart the app and install the update now?',
    buttons: ['Restart', 'Later']
  }).then((response) => {
    if (response.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});


let mainWindow;
let tray = null;

// Check for API key
const apiKey = store.get('apiKey');

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
        if (process.platform === 'win32') {
            // For Windows: Position the window in the bottom right-hand corner
            const { width, height } = screen.getPrimaryDisplay().workAreaSize;
            mainWindow.setPosition(width - mainWindow.getBounds().width, height - mainWindow.getBounds().height);
        } else {
            // For macOS: Position the window directly below the tray icon
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
    });
    
    
}

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
        mainWindow.webContents.openDevTools({ mode: 'undocked' });
    }

    mainWindow.webContents.openDevTools({ mode: 'undocked' });
      

    mainWindow.loadFile('window.html');
    mainWindow.on('blur', () => mainWindow.hide());
}


const fetchStoreDetails = async (apiKey) => {
  const storeDetailsUrl = 'https://api.shoprocket.io/v1/store/details';

  try {
    const response = await axios.get(storeDetailsUrl, {
      headers: {
        'x-api-key': apiKey // Make sure this matches the correct API key variable
      }
    });

    const { data } = response;
    console.log('Store details:', data);

    const { store_name, store_logo, store_environment, store_id, default_currency_symbol } = data.data;

    // save in storage
    store.set('store', {
      store_name,
      store_logo,
      store_environment,
      store_id,
      default_currency_symbol
    });

    // send to renderer
    mainWindow.webContents.send('store-details', {
      store_name,
      store_logo,
      store_environment,
      store_id,
      default_currency_symbol
    });

  } catch (error) {
    // Handle Axios-specific error details
    if (error.response) {
      console.error(`Error fetching store details: ${error.response.status} - ${error.response.statusText}`);
      Sentry.withScope(scope => {
        scope.setExtras({ responseBody: error.response.data });
        captureException(new Error(`${error.response.status} - ${error.response.statusText}`)); // Send the error to Sentry
      });
    } else {
      console.error('Error fetching store details:', error);
      captureException(error); // Send the error to Sentry
    }
  }
};


  
  


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.on('close-app', () => {
    app.quit();
});

ipcMain.handle('get-api-key', (event) => {
    return store.get('apiKey');
});

ipcMain.handle('set-api-key', (event, apiKey) => {
    store.set('apiKey', apiKey);
    return 'API Key saved successfully!';
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


  app.whenReady().then(async () => { // Add 'async' here
    if (process.platform === 'darwin') { // Check if the app is running on macOS
        app.dock.hide(); // Hide the dock icon
    }
    createTray();
    createWindow();

    mainWindow.webContents.on('did-finish-load', async () => {
        if (!apiKey || apiKey.trim() === '') {
            console.log('API key is not set. Showing settings window...');
            mainWindow.webContents.send('show-settings');
        } else {
            // Update the tray title
            tray.setTitle(`  $145.24`);

            console.log('API key is set. Fetching orders...');
            fetchStoreDetails(apiKey);
            const orders = await fetchOrders(); // Fetch orders immediately
            mainWindow.webContents.send('display-orders', orders);

            // Set an interval to refetch orders every 10 seconds
            setInterval(async () => {
                const orders = await fetchOrders();
                mainWindow.webContents.send('display-orders', orders);
            }, 10 * 1000);
        }
    });
});
