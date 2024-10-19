const { app, BrowserWindow, Menu, ipcMain, dialog, screen, Tray, shell } = require('electron')
const path = require('path');
const fs = require('fs')
const os = require('os')
const createShortcut = require('windows-shortcuts')
const startupFolderPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const prompt = require('electron-prompt');
const Store = require('electron-store');
const { DisableMinimize } = require('electron-disable-minimize');
const { exec } = require('child_process');
const store = new Store();
let tray = undefined;
let form = undefined;
var win = undefined;
let template = []
let loadingDialog;
let basePath = app.isPackaged ? './resources/app/' : './'


if (!app.requestSingleInstanceLock({ key: '电子课表' })) {
    app.quit();
}

console.log('Program started')

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
    })
    //    win.webContents.openDevTools()
    win.loadFile('index.html').catch(err => {
        console.error('Failed to load index.html:', err);
    });
    if (store.get('isWindowAlwaysOnTop', true)) {
        win.setAlwaysOnTop(true, 'screen-saver');
    }

}


function setAutoLaunch() {
    const shortcutName = '电子课表(请勿重命名).lnk'
    app.setLoginItemSettings({ // backward compatible
        openAtLogin: false,
        openAsHidden: false
    })
    if (store.get('isAutoLaunch', true)) {
        createShortcut.create(startupFolderPath + '/' + shortcutName,
            {
                target: app.getPath('exe'),
                workingDir: app.getPath('exe').split('\\').slice(0, -1).join('\\'),
            }, (e) => { e && console.log(e); })
    } else {
        fs.unlink(startupFolderPath + '/' + shortcutName, () => { })
    }

}

function scheduleShutdown(shutdownTime = "21:30") {
    const [hour, minute] = shutdownTime.split(':'); // 分割小时和分钟

    const now = new Date(); // 获取当前时间
    const shutdownDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0); // 创建关机时间的日期对象

    // 如果设定的时间已经过去，设定关机时间为第二天
    if (shutdownDate <= now) {
        shutdownDate.setDate(shutdownDate.getDate() + 1);
    }

    const delay = shutdownDate - now; // 计算延迟的毫秒数

    // 设置定时器
    setTimeout(() => {
        exec('shutdown /s /t 0', (error, stdout, stderr) => {
            if (error) {
                console.error(`err: ${error.message}`);
                dialog.showMessageBox(win, { title: 'Error!', message: `错误!: ${error.message}` })
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                dialog.showMessageBox(win, { title: 'Error!', message: `stderr: ${stderr}` })

                return;
            }
            console.log(`stdout: ${stdout}`);
        });
    }, delay);

    console.log(`Will close at: ${shutdownDate}`);
    console.log(`time to shut down: ${Math.ceil(delay / 1000)} s`);

    dialog.showMessageBox(win, {
        title: '关机提示!',
        message: `此电脑将关闭于: ${shutdownDate}` + '\n' + `剩余时间: ${Math.ceil(delay / 1000)} s`
    })
}

async function firstopen() {
    return await dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        title: '欢迎使用!',
        message: '欢迎使用电子课表,课程配置请在根目录中的js文件夹中的scheduleConfig.js文件进行修改' + '\n' + '\n' + '祝您使用愉快!(本提示只显示一次)' + '\n' + 'Developer : Enigfrank'
    })
}

function showLoadingDialog() {
    loadingDialog = new BrowserWindow({
        width: 300,
        height: 200,
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
    loadingDialog.loadFile('loading.html');
}

app.whenReady().then(async () => {
    // 检查是否是首次运行
    const isFirstRun = store.get('isFirstRun', true); // 默认为 true

    if (isFirstRun) {
        // 如果是第一次运行，显示欢迎对话框
        firstopen()
            .then(() => {
                // 设置已显示首次运行提示
                store.set('isFirstRun', false);

                // 欢迎对话框关闭后再创建主窗口
                createWindow();
                Menu.setApplicationMenu(null);
                win.webContents.on('did-finish-load', () => {
                    win.webContents.send('getWeekIndex');
                });

                const handle = win.getNativeWindowHandle();
                DisableMinimize(handle); // 感谢 peter 的项目 https://github.com/tbvjaos510/electron-disable-minimize
                setAutoLaunch();
            });
    } else {
        // 如果不是第一次启动，显示加载框
        showLoadingDialog();

        const randomTime = Math.random() * (1500 - 1000) + 500;

        // 模拟加载时间，2秒后关闭加载框，再创建主窗口
        setTimeout(() => {
            if (loadingDialog) {
                loadingDialog.close();
            }

            // 加载框关闭后再创建主窗口
            createWindow();
            Menu.setApplicationMenu(null);

            win.webContents.on('did-finish-load', () => {
                win.webContents.send('getWeekIndex');
            });

            const handle = win.getNativeWindowHandle();
            DisableMinimize(handle); // 感谢 peter 的项目 https://github.com/tbvjaos510/electron-disable-minimize
            setAutoLaunch();
        }, randomTime); // 加载持续时间 2 秒
    }
});

ipcMain.on('getWeekIndex', (e, arg) => {
    tray = new Tray(basePath + 'image/icon.png')
    template = [
        {
            label: '第一周',
            type: 'radio',
            click: () => {
                win.webContents.send('setWeekIndex', 0)
            }
        },
        {
            label: '第二周',
            type: 'radio',
            click: () => {
                win.webContents.send('setWeekIndex', 1)
            }
        },
        {
            type: 'separator'
        },
        {
            icon: basePath + 'image/setting.png',
            label: '配置课表',
            click: () => {
                win.webContents.send('openSettingDialog')
            }
        },
        {
            icon: basePath + 'image/clock.png',
            label: '矫正计时',
            click: () => {
                win.webContents.send('getTimeOffset')
            }
        },
        {
            icon: basePath + 'image/toggle.png',
            label: '切换日程',
            click: () => {
                win.webContents.send('setDayOffset')
            }
        },
        {
            type: 'separator'
        },
        {
            id: 'countdown',
            label: '课上计时',
            type: 'checkbox',
            checked: store.get('isDuringClassCountdown', true),
            click: (e) => {
                store.set('isDuringClassCountdown', e.checked)
                win.webContents.send('ClassCountdown', e.checked)
            }
        },
        {
            label: '窗口置顶',
            type: 'checkbox',
            checked: store.get('isWindowAlwaysOnTop', true),
            click: (e) => {
                store.set('isWindowAlwaysOnTop', e.checked)
                if (store.get('isWindowAlwaysOnTop', true))
                    win.setAlwaysOnTop(true, 'screen-saver', 9999999999999)
                else
                    win.setAlwaysOnTop(false)
            }
        },
        {
            label: '上课隐藏',
            type: 'checkbox',
            checked: store.get('isDuringClassHidden', true),
            click: (e) => {
                store.set('isDuringClassHidden', e.checked)
                win.webContents.send('ClassHidden', e.checked)
            }
        },
        {
            label: '开机启动',
            type: 'checkbox',
            checked: store.get('isAutoLaunch', true),
            click: (e) => {
                store.set('isAutoLaunch', e.checked)
                setAutoLaunch()
            }
        },

        {
            label: '定时关机',
            type: 'checkbox',
            checked: store.get('scheduleShutdown', true),
            click: (e) => {
                // 使用 e.checked 来设置存储状态
                store.set('scheduleShutdown', e.checked);

                // 如果用户选择定时关机，则调用 scheduleShutdown
                if (e.checked) {
                    scheduleShutdown();
                }
            }
        },

        {
            type: 'separator'
        },
        {
            icon: basePath + 'image/debug.png',
            label: 'Devtool',
            click: () => {
                if (win.webContents.isDevToolsOpened()) {
                    win.webContents.closeDevTools();
                } else {
                    win.webContents.openDevTools();
                }
            }
        },
        {
            label: '开发者选项',
            click: () => {
                dialog.showMessageBox({
                    title: 'Reset',
                    message: '请选择重置内容',
                    buttons: ['isFirstRun | 会自动重启', 'other'],
                }).then((data) => {
                    if (data.response === 0) { store.set('isFirstRun', true); app.relaunch(); app.exit(0); }
                    else (data.response === 1); { dialog.showMessageBox(win, { title: '啊哦!', message: `不要乱点!!!` }) }
                })
            }
        },
        {
            icon: basePath + 'image/info.png',
            label: '更多信息',
            click: () => {
                dialog.showMessageBox({
                    type: 'info',
                    buttons: ['OK'],
                    title: 'Let us across hell and reach to heaven！',
                    message: '此版本构建于2024/10/19' + '\n' + '\n' + '作者: EnderWolf  二次开发: Enigfrank' + '\n' + '课程配置请在根目录中的js文件夹中的scheduleConfig.js文件进行修改',
                })
            }
        },

        {
            icon: basePath + 'image/quit.png',
            label: '退出程序',
            click: () => {
                dialog.showMessageBox(win, {
                    title: '请确认',
                    message: '你确定要退出程序吗?',
                    buttons: ['取消', '确定']
                }).then((data) => {
                    if (data.response) app.quit()
                })
            }
        }
    ]
    template[arg].checked = true
    form = Menu.buildFromTemplate(template)
    tray.setToolTip('电子课表')
    function trayClicked() {
        tray.popUpContextMenu(form)
    }
    tray.on('click', trayClicked)
    tray.on('right-click', trayClicked)
    tray.setContextMenu(form)
    win.webContents.send('ClassCountdown', store.get('isDuringClassCountdown', true))
    win.webContents.send('ClassHidden', store.get('isDuringClassHidden', true))
})

ipcMain.on('log', (e, arg) => {
    console.log(arg);
})


ipcMain.on('setIgnore', (e, arg) => {
    if (arg)
        win.setIgnoreMouseEvents(true, { forward: true });
    else
        win.setIgnoreMouseEvents(false);
})
ipcMain.on('dialog', (e, arg) => {
    dialog.showMessageBox(win, arg.options).then((data) => {
        e.reply(arg.reply, { 'arg': arg, 'index': data.response })
    })
})

ipcMain.on('pop', (e, arg) => {
    tray.popUpContextMenu(form)
})

ipcMain.on('getTimeOffset', (e, arg) => {
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
        icon: basePath + 'image/clock.png',
    }).then((r) => {
        if (r === null) {
            console.log('[getTimeOffset] User cancelled');
            dialog.showMessageBox(win, { title: 'Warn!', message: `您取消了操作!` })

        } else {
            win.webContents.send('setTimeOffset', Number(r) % 10000000000000)
            dialog.showMessageBox(win, { title: 'Warn!', message: `修改偏移成功!` })
        }
    })
})