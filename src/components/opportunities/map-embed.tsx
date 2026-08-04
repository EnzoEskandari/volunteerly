export function MapEmbed({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const delta = 0.01;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-100">
      <iframe
        title={`Map showing ${label}`}
        src={src}
        className="h-64 w-full"
        loading="lazy"
        style={{ border: 0 }}
      />
    </div>
  );
}
