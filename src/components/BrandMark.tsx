/** The FrameTV mark (brand/mark.svg). Static SVG, so a plain <img> is right. */
export default function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/mark.svg"
      alt="FrameTV"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
