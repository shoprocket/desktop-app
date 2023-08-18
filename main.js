const { app, BrowserWindow, Tray, nativeImage, ipcMain, screen } = require('electron');
const Store = require('electron-store');
const store = new Store(); // Initialize store
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

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
        const trayBounds = tray.getBounds();
        const yPosition = process.platform === 'darwin' ? trayBounds.y : trayBounds.y + trayBounds.height;
        const newX = Math.round(trayBounds.x - trayBounds.width / 2);
        const newY = Math.round(yPosition);
        const windowBounds = mainWindow.getBounds();

        mainWindow.setBounds({
            x: newX,
            y: newY,
            width: windowBounds.width, // Keep the current width
            height: windowBounds.height // Keep the current height
        });


    
        if (mainWindow.isVisible()) { 
            mainWindow.hide();
        } else {
            mainWindow.show();
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
      

    mainWindow.loadFile('window.html');
    mainWindow.on('blur', () => mainWindow.hide());
}


const fetchStoreDetails = async (apiKey) => {
    const storeDetailsUrl = 'https://api.shoprocket.io/v1/store/details';
    
    const options = {
      method: 'GET',
      headers: {
        'x-api-key': apiKey // Make sure this matches the correct API key variable
      }
    };
  
    try {
      const response = await fetch(storeDetailsUrl, options);
  
      if (!response.ok) {
        // Log the response status and body for better diagnostics
        console.error(`Error fetching store details: ${response.status} - ${response.statusText}`);
        const text = await response.text();
        console.error('Response body:', text);
        return;
      }
  
      const data = await response.json();
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
      console.error('Error fetching store details:', error);
      // Handle the error appropriately
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
        // Dynamically import the fetch function from the 'node-fetch' module
        const fetch = await import('node-fetch');

        // Make the API request
        const response = await fetch.default(apiUrl, { headers });

        if (!response.ok) {
            throw new Error('Failed to fetch orders. Please check the API key and try again.');
        }
        
        const orders = await response.json();
        return orders;
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

    if (!apiKey || apiKey.trim() === '') {
        console.log('API key is not set. Showing settings window...');
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('show-settings');
        });
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
