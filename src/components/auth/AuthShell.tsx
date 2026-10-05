'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import BrandMark from '@/components/BrandMark';

export default function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-sm font-semibold">
          <BrandMark size={36} />
          FrameTV
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {children}
            <div className="text-sm text-muted-foreground text-center">{footer}</div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
