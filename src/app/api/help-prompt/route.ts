import { NextRequest } from 'next/server';
import { helpPrompt } from '@/lib/helpPrompt';

// GET /api/help-prompt — plain-text "ask an AI" prompt, used by the Mac app.
export function GET(request: NextRequest) {
  return new Response(helpPrompt(request.nextUrl.origin), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
