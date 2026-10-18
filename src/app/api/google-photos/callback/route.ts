import { NextRequest, NextResponse } from 'next/server';
import { pickerFetch, readAuth, redirectUri, writeAuth } from '@/lib/googlePhotos/oauth';

function page(title: string, body: string, ok: boolean) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:16px -apple-system,system-ui,sans-serif;background:#f2f2f7;color:#000;text-align:center;padding:24px}
@media(prefers-color-scheme:dark){body{background:#000;color:#fff}}.c{max-width:420px}.i{font-size:56px}h1{font-size:28px;margin:12px 0 8px;letter-spacing:-.02em}p{color:#8e8e93;line-height:1.5}</style></head>
<body><div class="c"><div class="i">${ok ? '✅' : '⚠️'}</div><h1>${title}</h1><p>${body}</p></div><script>setTimeout(()=>window.close(),2500)</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// GET — Google sends the person back here (in their real browser). Store
// the token and a fresh picker session on the nonce; the Mantel app or tab
// that started the flow picks it up from there.
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const nonce = p.get('state') ?? '';
  const auth = await readAuth(nonce);
  if (!auth) return page('That link expired', 'Go back to Mantel and tap Google Photos again.', false);

  if (p.get('error') || !p.get('code')) {
    await writeAuth(nonce, { ...auth.value, status: 'error', error: p.get('error') === 'access_denied' ? 'denied' : 'error' });
    return page('Google Photos wasn’t connected', 'Access wasn’t allowed. Go back to Mantel to try again.', false);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: p.get('code')!,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        redirect_uri: redirectUri(request),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
    const { access_token } = (await tokenRes.json()) as { access_token: string };
    const session = (await pickerFetch(access_token, '/sessions', { method: 'POST', body: '{}' })) as { id: string; pickerUri: string };
    await writeAuth(nonce, { ...auth.value, status: 'ready', token: access_token, session_id: session.id, picker_uri: session.pickerUri });

    // The Mantel tab or app that started this is waiting and carries on by itself.
    return page('Google Photos connected', 'You can close this tab and go back to Mantel. It’s ready for you to pick photos.', true);
  } catch (err) {
    console.error('[google-photos/callback]', err);
    await writeAuth(nonce, { ...auth.value, status: 'error', error: 'error' });
    return page('Something went wrong', 'Go back to Mantel and try Google Photos again.', false);
  }
}
