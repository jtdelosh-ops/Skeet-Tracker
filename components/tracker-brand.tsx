export function TrackerBrand() {
  return <div className="tracker-brand">
    {/* The wordmark is the heading; the image's target and trail are decorative. */}
    <h1 aria-label="Skeet Tracker"><svg viewBox="0 170 2172 310" width="2172" height="310" aria-hidden="true" focusable="false">
      <defs><filter id="logo-background" colorInterpolationFilters="sRGB">
        {/* Render the white matte as transparent, including the fading motion trail. */}
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 0 3" />
      </filter></defs>
      <image href="/skeet-tracker-logo.png" width="2172" height="724" filter="url(#logo-background)" />
    </svg></h1>
    <p>By James Delosh</p>
  </div>;
}
