'use client';

import { useEffect } from 'react';

// Landing spot after signing in from the Mac app's screensaver setup:
// hands control back to the app's setup screen.
export default function AppReturn() {
  useEffect(() => {
    if (window.mantel?.isApp) window.mantel.openScreensaverSetup();
    else window.location.replace('/admin');
  }, []);
  return null;
}
