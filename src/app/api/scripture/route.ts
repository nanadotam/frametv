import { NextRequest, NextResponse } from 'next/server';

export interface ScriptureVerse {
  text: string;
  reference: string;
  translation: string;
}

// Translations Our Manna supports natively
const OUR_MANNA_VERSIONS = new Set(['KJV', 'NKJV', 'NIV', 'NLT', 'ESV', 'MSG', 'AMP', 'NASB', 'CEV', 'WEB']);

async function fromOurManna(translation: string): Promise<ScriptureVerse | null> {
  const version = OUR_MANNA_VERSIONS.has(translation) ? translation : 'KJV';
  try {
    const res = await fetch(
      `https://beta.ourmanna.com/api/v1/get?format=json&order=daily&version=${version}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { verse?: { details?: { text?: string; reference?: string; version?: string } } };
    const d = data?.verse?.details;
    if (!d?.text || !d?.reference) return null;
    return {
      text: d.text.trim(),
      reference: d.reference.trim(),
      translation: d.version ?? version,
    };
  } catch {
    return null;
  }
}

async function fromLabsBibleOrg(): Promise<ScriptureVerse | null> {
  try {
    const res = await fetch(
      'https://labs.bible.org/api/?passage=votd&type=json',
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const data = await res.json() as Array<{ bookname: string; chapter: string; verse: string; text: string }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    const last = data[data.length - 1];
    const reference = data.length === 1
      ? `${first.bookname} ${first.chapter}:${first.verse}`
      : `${first.bookname} ${first.chapter}:${first.verse}–${last.verse}`;
    return {
      text: data.map((v) => v.text).join(' ').trim(),
      reference,
      translation: 'NET',
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const translation = request.nextUrl.searchParams.get('translation') ?? 'KJV';
  const verse = (await fromOurManna(translation)) ?? (await fromLabsBibleOrg());

  if (!verse) {
    return NextResponse.json({ error: 'Could not fetch verse of the day' }, { status: 502 });
  }

  return NextResponse.json(verse, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
