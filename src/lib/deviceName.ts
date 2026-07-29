'use client';

/**
 * Best-effort device label derived from what a browser actually exposes
 * (no hostname access — browsers don't expose that to JS). Good enough to
 * auto-fill the "device name" field instead of asking the user to type it;
 * still editable since it's a guess, not a hard fact.
 */
export function guessDeviceName(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;

  const platform =
    /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android device'
    : /Windows/.test(ua) ? 'Windows PC'
    : /Linux/.test(ua) ? 'Linux device'
    : 'Device';

  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /CriOS\//.test(ua) ? 'Chrome'
    : /FxiOS\//.test(ua) ? 'Firefox'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Version\/.*Safari\//.test(ua) ? 'Safari'
    : '';

  return browser ? `${platform} (${browser})` : platform;
}
