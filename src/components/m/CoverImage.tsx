/**
 * An album cover that fills its box and is shown upright, even when the
 * photo is stored sideways (metadata.rotation). Uses container query units
 * so a 90°/270° image swaps width and height to still cover the box.
 */
export function CoverImage({ src, rotation = 0, className = '' }: { src: string; rotation?: number; className?: string }) {
  const sideways = rotation === 90 || rotation === 270;
  return (
    <div className={`absolute inset-0 overflow-hidden [container-type:size] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className="absolute left-1/2 top-1/2 max-w-none object-cover"
        style={{
          width: sideways ? '100cqh' : '100cqw',
          height: sideways ? '100cqw' : '100cqh',
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}
      />
    </div>
  );
}
