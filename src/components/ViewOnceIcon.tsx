// The view-once mark: a dashed ring with a "1" inside. When opened, the "1" is gone.
export default function ViewOnceIcon({ size = 20, opened = false, className }: { size?: number; opened?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.5" strokeWidth="1.9" strokeDasharray={opened ? "1.6 3" : "3.2 2.4"} />
      {!opened && <path d="M10.2 9.1 12.7 7.5v9" strokeWidth="2.1" />}
    </svg>
  );
}
