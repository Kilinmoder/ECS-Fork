// 全局变量定义
let win = undefined;
let tray = undefined;
let testGUIWindow = undefined; // 新定义的测试GUI窗口变量
let loadingDialog = undefined; // 添加加载对话框变量
let shutdownTimers = []; // 添加定时关机计时器数组

const { app, BrowserWindow, Menu, ipcMain, dialog, screen, Tray, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const createShortcut = require('windows-shortcuts');
const prompt = require('electron-prompt');
const Store = require('electron-store');
const { DisableMinimize } = require('electron-disable-minimize');
const { exec } = require('child_process');
const store = new Store();
const basePath = app.isPackaged ? path.join(__dirname, '..') : __dirname;
const startupFolderPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');

// 检查单例锁
if (!app.requestSingleInstanceLock({ key: '电子课表' })) {
    app.quit();
}

console.log('Program started');

// 创建主窗口
const createWindow = () => {
    win = new BrowserWindow({
        x: 0,
        y: 0,
        width: screen.getPrimaryDisplay().workAreaSize.width,
        height: 200,
        frame: false,
        transparent: true,
        alwaysOnTop: store.get('isWindowAlwaysOnTop', true),
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
        resizable: false,
        type: 'toolbar',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
    });
    win.loadFile(path.join(__dirname, 'index.html')).catch(err => {
        console.error('Failed to load index.html:', err);
    });
    if (store.get('isWindowAlwaysOnTop', true)) {
        win.setAlwaysOnTop(true, 'screen-saver');
    }
};

// 自动启动设置
function setAutoLaunch() {
    const shortcutName = '电子课表(请勿重命名).lnk';
    app.setLoginItemSettings({
        openAtLogin: false,
        openAsHidden: false
    });
    if (store.get('isAutoLaunch', true)) {
        createShortcut.create(path.join(startupFolderPath, shortcutName), {
            target: app.getPath('exe'),
            workingDir: path.dirname(app.getPath('exe')),
        }, (err) => {
            if (err) {
                console.error('Error creating shortcut:', err);
                dialog.showErrorBox('错误', '创建快捷方式时出错: ' + err.message);
            }
        });
    } else {
        fs.unlink(path.join(startupFolderPath, shortcutName), (err) => {
            if (err) {
                console.error('Error deleting shortcut:', err);
                dialog.showErrorBox('错误', '删除快捷方式时出错: ' + err.message);
            }
        });
    }
}

// 定时关机功能
function scheduleShutdown(shutdownTimes = ["12:11", "21:30"]) {
    clearScheduledShutdown();
    const now = new Date();
    shutdownTimes.forEach((shutdownTime) => {
        const [hour, minute] = shutdownTime.split(':');
        const shutdownDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
        if (shutdownDate <= now) {
            shutdownDate.setDate(shutdownDate.getDate() + 1);
        }
        const delay = shutdownDate - now;
        if (delay < 0) return; // Skip if time has already passed
        const timerId = setTimeout(() => {
            exec('shutdown /s /t 0', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error: ${error.message}`);
                    dialog.showMessageBox({ title: 'Error!', message: `错误!: ${error.message}` });
                    return;
                }
                if (stderr) {
                    console.error(`stderr: ${stderr}`);
                    dialog.showMessageBox({ title: 'Error!', message: `stderr: ${stderr}` });
                    return;
                }
                console.log(`Shutdown at: ${shutdownDate}`);
            });
        }, delay);
        shutdownTimers.push(timerId);
        console.log(`Will close at: ${shutdownDate}`);
        dialog.showMessageBox({
            title: '关机提示!',
            message: `此电脑将关闭于: ${shutdownDate}\n剩余时间: ${Math.ceil(delay / 1000)} 秒`
        });
    });
}

// 定义取消定时关机的函数
function clearScheduledShutdown() {
    shutdownTimers.forEach(timerId => clearTimeout(timerId));
    shutdownTimers.length = 0; // 清空数组
    console.log('Scheduled shutdown canceled');
    dialog.showMessageBox({
        title: '关机取消',
        message: '已取消定时关机'
    });
}

// 初始化定时关机
function initializeShutdownSchedule() {
    const isScheduled = store.get('scheduleShutdown', false);
    if (isScheduled) {
        scheduleShutdown();
    }
}

// 欢迎对话框
async function firstopen() {
    return await dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        title: '欢迎使用!',
        message: '欢迎使用电子课表,课程配置请在根目录中的js文件夹中的scheduleConfig.js文件进行修改' + '\n' + '\n' + '祝您使用愉快!(本提示只显示一次)' + '\n' + 'Developer : Enigfrank'
    });
}

// 显示加载对话框
function showLoadingDialog() {
    loadingDialog = new BrowserWindow({
        width: 600,
        height: 400,
        frame: false, // 无边框窗口
        alwaysOnTop: true, // 窗口置顶
        modal: true, // 模态窗口
        parent: win, // 指定父窗口
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 加载自定义的加载界面，可以放一个简单的 HTML 文件
    loadingDialog.loadFile(path.join(__dirname, 'loading1.html'));
}

// 创建测试GUI窗口
function showTestGUIWindow() {
    if (testGUIWindow) {
        testGUIWindow.show();
    } else {
        testGUIWindow = new BrowserWindow({
            width: 600,
            height: 800, // 增加高度以容纳更多内容
            title: '课表管理',
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true
            }
        });
        testGUIWindow.loadFile(path.join(__dirname, 'testGUI.html'));
        testGUIWindow.on('close', () => {
            testGUIWindow = null;
        });

        // 在窗口加载完成后，发送初始化数据
        testGUIWindow.webContents.on('did-finish-load', () => {
            testGUIWindow.webContents.send('init', {
                isDuringClassCountdown: store.get('isDuringClassCountdown', true),
                isWindowAlwaysOnTop: store.get('isWindowAlwaysOnTop', true),
                isDuringClassHidden: store.get('isDuringClassHidden', true),
                isAutoLaunch: store.get('isAutoLaunch', true),
                scheduleShutdown: store.get('scheduleShutdown', false)
            });
        });
    }
}

// 更新托盘菜单
function updateTrayMenu() {
    if (tray) {
        const contextMenu = Menu.buildFromTemplate(getTrayMenuTemplate());
        tray.setContextMenu(contextMenu);
    }
}

// 获取托盘菜单模板
function getTrayMenuTemplate() {
    return [
        {
            icon: path.join(basePath, 'image', 'setting.png'),
            label: '打开配置界面',
            click: () => {
                showTestGUIWindow();
            }
        },
        {
            type: 'separator'
        },
        {
            icon: path.join(basePath, 'image', 'quit.png'),
            label: '退出程序',
            click: () => {
                dialog.showMessageBox(win, {
                    title: '请确认',
                    message: '你确定要退出程序吗?',
                    buttons: ['取消', '确定']
                }).then((data) => {
                    if (data.response) app.quit();
                });
            }
        }
    ];
}

// 托盘点击事件处理
function trayClicked() {
    // 托盘点击事件处理逻辑（根据需求定义）
}

app.whenReady().then(async () => {
    const isFirstRun = store.get('isFirstRun', true);
    if (isFirstRun) {
        await firstopen();
        store.set('isFirstRun', false);
        createWindow();
        Menu.setApplicationMenu(null);
        win.webContents.on('did-finish-load', () => {
            win.webContents.send('getWeekIndex');
        });
        const handle = win.getNativeWindowHandle();
        DisableMinimize(handle);
        setAutoLaunch();
    } else {
        showLoadingDialog();
        setTimeout(() => {
            if (loadingDialog) {
                loadingDialog.close();
            }
            createWindow();
            Menu.setApplicationMenu(null);
            win.webContents.on('did-finish-load', () => {
                win.webContents.send('getWeekIndex');
            });
            const handle = win.getNativeWindowHandle();
            DisableMinimize(handle);
            setAutoLaunch();
        }, 1000); // 固定延迟时间，提升用户体验
    }
});

// 保留托盘菜单功能
ipcMain.on('getWeekIndex', (e, arg) => {
    tray = new Tray(path.join(basePath, 'image', 'icon.png'));
    tray.setToolTip('电子课表');
    tray.on('click', trayClicked);

    // 初始化托盘菜单
    updateTrayMenu();
});

// 集中管理IPC事件
const ipcEvents = {
    'setWeekIndex': (e, index) => {
        win.webContents.send('setWeekIndex', index);
    },
    'openSettingDialog': () => {
        win.webContents.send('openSettingDialog');
    },
    'setDayOffset': () => {
        win.webContents.send('setDayOffset');
    },
    'setClassCountdown': (e, checked) => {
        store.set('isDuringClassCountdown', checked);
        win.webContents.send('ClassCountdown', checked);
        updateTrayMenu();
    },
    'setWindowAlwaysOnTop': (e, checked) => {
        store.set('isWindowAlwaysOnTop', checked);
        if (checked) {
            win.setAlwaysOnTop(true, 'screen-saver', 9999999999999);
        } else {
            win.setAlwaysOnTop(false);
        }
        updateTrayMenu();
    },
    'setDuringClassHidden': (e, checked) => {
        store.set('isDuringClassHidden', checked);
        win.webContents.send('ClassHidden', checked);
        updateTrayMenu();
    },
    'setAutoLaunch': (e, checked) => {
        store.set('isAutoLaunch', checked);
        setAutoLaunch();
        updateTrayMenu();
    },
    'setScheduleShutdown': (e, checked) => {
        store.set('scheduleShutdown', checked);
        if (checked) {
            scheduleShutdown();
        } else {
            clearScheduledShutdown();
        }
        updateTrayMenu();
    },
    'openDevTools': () => {
        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools();
        } else {
            win.webContents.openDevTools();
        }
    },
    'resetSettings': () => {
        dialog.showMessageBox({
            title: 'Reset',
            message: '请选择重置内容',
            buttons: ['isFirstRun | 会自动重启', 'other'],
        }).then((data) => {
            if (data.response === 0) { 
                store.set('isFirstRun', true); 
                app.relaunch(); 
                app.exit(0); 
            } else if (data.response === 1) { 
                dialog.showMessageBox(win, { title: '啊哦!', message: `不要乱点!!!` }); 
            }
        });
    },
    'showMoreInfo': () => {
        dialog.showMessageBox({
            type: 'info',
            buttons: ['OK'],
            title: 'Let us across hell and reach to heaven！',
            message: '此版本构建于2025/1/1' + '\n' + '\n' + '作者: EnderWolf  二次开发: Enigfrank' + '\n' + '课程配置请在根目录中的js文件夹中的scheduleConfig.js文件进行修改',
        });
    },
    'quitApp': () => {
        dialog.showMessageBox(win, {
            title: '请确认',
            message: '你确定要退出程序吗?',
            buttons: ['取消', '确定']
        }).then((data) => {
            if (data.response) app.quit();
        });
    },
    'log': (e, arg) => {
        console.log(arg);
    },
    'setIgnore': (e, arg) => {
        if (arg) {
            win.setIgnoreMouseEvents(true, { forward: true });
        } else {
            win.setIgnoreMouseEvents(false);
        }
    },
    'dialog': (e, arg) => {
        dialog.showMessageBox(win, arg.options).then((data) => {
            e.reply(arg.reply, { 'arg': arg, 'index': data.response });
        });
    },
    'pop': (e, arg) => {
        tray.popUpContextMenu();
    },
    'getTimeOffset': (e, arg = 0) => { // 默认值为 0，避免 undefined
        prompt({
            title: '计时矫正',
            label: '请设置课表计时与系统时间的偏移秒数:',
            value: arg.toString(),
            inputAttrs: {
                type: 'number'
            },
            type: 'input',
            height: 180,
            width: 400,
            icon: path.join(basePath, 'image', 'clock.png'),
        }).then((r) => {
            if (r === null) {
                console.log('[getTimeOffset] User cancelled');
                dialog.showMessageBox(win, { title: 'Warn!', message: `您取消了操作!` });
            } else {
                win.webContents.send('setTimeOffset', Number(r) % 10000000000000);
                dialog.showMessageBox(win, { title: 'Warn!', message: `修改偏移成功!` });
            }
        }).catch((err) => {
            console.error('Error in prompt:', err);
        });
    },
};

for (const [event, handler] of Object.entries(ipcEvents)) {
    ipcMain.on(event, handler);
}

app.on('before-quit', () => {
    if (testGUIWindow) {
        testGUIWindow.close();
    }
});