/**
 * Created by ed on 25.11.17.
 */

'use strict';

const {app, BrowserWindow} = require('electron');
const path = require('path');
const url = require('url');

const APP_DIR = path.join(__dirname, 'app');
const ENTRY = 'index.html';

app.on('ready', () => {
    const mainWindow = new BrowserWindow();
    mainWindow.setMenu(null);
    mainWindow.loadURL(url.format({
        pathname: path.join(APP_DIR, ENTRY),
        protocol: 'file:',
        webSecurity: false,
        slashes: true
    }));
});
