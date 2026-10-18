// Bridge exposed by the Mantel Mac app's preload script (desktop/preload.js).
export {};

declare global {
  interface Window {
    mantel?: {
      isApp: true;
      openScreensaverSetup: () => void;
      openSite?: (pathname: string) => void;
      toggleFullscreen?: () => void;
      openPhotosApp?: () => void;
    };
  }
}
