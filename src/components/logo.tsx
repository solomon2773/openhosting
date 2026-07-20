// OpenHosting "Open Rack" logo — a tray pulled out from the rack. The pulled
// tray uses the brand color (via currentColor, so it follows the active theme);
// the seated bars are slate. Two exports: LogoMark (icon only) and Logo
// (mark + wordmark).

export function LogoMark({
  className = "",
  size = 32,
  tone = "light",
}: {
  className?: string;
  size?: number;
  // "light" = dark bars for light backgrounds; "dark" = light bars for dark ones
  tone?: "light" | "dark";
}) {
  const bar = tone === "dark" ? "fill-slate-300" : "fill-slate-800";
  const dot = tone === "dark" ? "fill-slate-900" : "fill-white";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-brand-600 ${className}`}
      role="img"
      aria-label="OpenHosting"
    >
      {/* seated trays */}
      <rect x="4" y="14" width="24" height="5" rx="2.5" className={bar} />
      <rect x="4" y="22" width="24" height="5" rx="2.5" className={bar} />
      {/* top row: short seated stub with a status dot */}
      <rect x="4" y="6" width="10" height="5" rx="2.5" className={bar} />
      <circle cx="8.5" cy="8.5" r="1.4" className={dot} />
      {/* the pulled-out tray, in the brand color */}
      <rect x="15" y="5.5" width="14" height="6" rx="3" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  companyName = "OpenHosting",
  markSize = 32,
  className = "",
}: {
  companyName?: string;
  markSize?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={markSize} />
      <span className="text-xl font-semibold text-slate-900">{companyName}</span>
    </span>
  );
}
