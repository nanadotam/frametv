'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, DownloadSimple, Key } from '@phosphor-icons/react';
import { Button } from '@/components/m/Controls';
import { toast } from '@/components/m/Toast';

/**
 * Shows a freshly issued recovery key exactly once: the key itself, a QR
 * code that opens the reset page with the key filled in, and ways to keep
 * it (copy, download as a card image or text file).
 */
export function RecoveryKeyCard({ recoveryKey, email }: { recoveryKey: string; email?: string | null }) {
  const [qr, setQr] = useState<string | null>(null);
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/recover?key=${encodeURIComponent(recoveryKey)}`;

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#1c1c1e', light: '#ffffff' } }).then(setQr);
  }, [url]);

  const downloadText = () => {
    const body = [
      'MANTEL RECOVERY KEY',
      '',
      recoveryKey,
      '',
      email ? `Account: ${email}` : '',
      'If you forget your password, go to the Mantel sign-in page,',
      'tap "Forgot password?" and enter this key, or scan the QR code',
      'on your recovery card. Keep it somewhere safe and private.',
      '',
      url,
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    a.download = 'Mantel-Recovery-Key.txt';
    a.click();
  };

  const downloadCard = async () => {
    if (!qr) return;
    const c = document.createElement('canvas');
    c.width = 1080;
    c.height = 1350;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 1080, 1350);
    grad.addColorStop(0, '#ffb547');
    grad.addColorStop(0.5, '#f2622e');
    grad.addColorStop(1, '#c92d5c');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(90, 90, 900, 1170, 48);
    g.fill();
    g.fillStyle = '#1c1c1e';
    g.font = '700 64px -apple-system, Helvetica, sans-serif';
    g.textAlign = 'center';
    g.fillText('Mantel Recovery Key', 540, 220);
    g.font = '400 34px -apple-system, Helvetica, sans-serif';
    g.fillStyle = '#6b6b70';
    if (email) g.fillText(email, 540, 280);
    const img = new Image();
    img.src = qr;
    await img.decode();
    g.drawImage(img, 270, 330, 540, 540);
    g.fillStyle = '#1c1c1e';
    g.font = '600 46px ui-monospace, Menlo, monospace';
    g.fillText(recoveryKey, 540, 960);
    g.font = '400 30px -apple-system, Helvetica, sans-serif';
    g.fillStyle = '#6b6b70';
    ['Forgot your password? Scan this code', 'or type the key on the sign-in page.', 'Keep this somewhere safe and private.'].forEach((l, i) =>
      g.fillText(l, 540, 1060 + i * 46)
    );
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'Mantel-Recovery-Key.png';
    a.click();
  };

  return (
    <div className="overflow-hidden rounded-[20px] bg-cell shadow-cell">
      <div className="bg-ember px-5 py-4 text-white">
        <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-white/85">
          <Key size={16} weight="fill" /> Your recovery key
        </p>
        <p className="mt-1 text-[15px] leading-snug text-white/90">
          This is the only way back in if you forget your password. We can’t see it or resend it.
        </p>
      </div>
      <div className="flex flex-col items-center gap-4 p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="Recovery QR code" className="h-44 w-44 rounded-xl" />}
        <p className="select-all break-all text-center font-mono text-[19px] font-semibold tracking-wide">{recoveryKey}</p>
        <div className="grid w-full grid-cols-3 gap-2">
          <Button
            variant="gray"
            size="md"
            icon={<Copy size={18} weight="bold" />}
            onClick={async () => {
              await navigator.clipboard.writeText(recoveryKey);
              toast('Recovery key copied');
            }}
          >
            Copy
          </Button>
          <Button variant="gray" size="md" icon={<DownloadSimple size={18} weight="bold" />} onClick={downloadCard}>
            Image
          </Button>
          <Button variant="gray" size="md" icon={<DownloadSimple size={18} weight="bold" />} onClick={downloadText}>
            Text
          </Button>
        </div>
        <p className="text-center text-[13px] text-label-2">
          Tip: take a screenshot, or save the image to your Photos or password manager.
        </p>
      </div>
    </div>
  );
}
