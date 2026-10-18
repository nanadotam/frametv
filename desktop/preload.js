// Bridges the window to the main process. The Mantel website only gets
// harmless navigation helpers; the bundled local pages (file://) also get
// the screensaver install/connect calls.

const { contextBridge, ipcRenderer } = require('electron');

const isLocal = location.protocol === 'file:';

const api = {
  isApp: true,
  openScreensaverSetup: () => ipcRenderer.invoke('mantel:open-setup'),
  openSite: (pathname) => ipcRenderer.invoke('mantel:open-site', pathname),
};

if (isLocal) {
  Object.assign(api, {
    site: () => ipcRenderer.invoke('mantel:site'),
    finishOnboarding: (next) => ipcRenderer.invoke('mantel:finish-onboarding', { next }),
    status: () => ipcRenderer.invoke('mantel:saver-status'),
    installSaver: () => ipcRenderer.invoke('mantel:install-saver'),
    connectSaver: () => ipcRenderer.invoke('mantel:connect-saver'),
    openScreensaverSettings: () => ipcRenderer.invoke('mantel:open-screensaver-settings'),
    openPrivacy: () => ipcRenderer.invoke('mantel:open-privacy'),
    preview: () => ipcRenderer.invoke('mantel:preview'),
    copy: (text) => ipcRenderer.invoke('mantel:copy', text),
    signIn: () => ipcRenderer.invoke('mantel:sign-in'),
    update: () => ipcRenderer.invoke('mantel:update'),
    connectCode: () => ipcRenderer.invoke('mantel:connect-code'),
    macos: () => ipcRenderer.invoke('mantel:macos'),
    openSettingsPane: (pane) => ipcRenderer.invoke('mantel:open-settings-pane', pane),
  });
}

contextBridge.exposeInMainWorld('mantel', api);
