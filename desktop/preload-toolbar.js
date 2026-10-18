// The toolbar only sends navigation actions and receives page state.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mantelToolbar', {
  act: (action) => ipcRenderer.send('toolbar:action', action),
  onState: (cb) => ipcRenderer.on('toolbar:state', (_e, state) => cb(state)),
});
