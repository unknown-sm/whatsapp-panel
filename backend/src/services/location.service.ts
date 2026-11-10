export interface IncomingLocation {
  latitude: number;
  longitude: number;
  name: string | null;
  address: string | null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Normaliza una ubicación de Cloud API y rechaza coordenadas inválidas. */
export function extractLocationFromPayload(message: any): IncomingLocation | null {
  const location = message?.location;
  if (!location) return null;

  const rawLatitude = location.latitude;
  const rawLongitude = location.longitude;
  if (
    rawLatitude === null || rawLongitude === null ||
    (typeof rawLatitude === "string" && !rawLatitude.trim()) ||
    (typeof rawLongitude === "string" && !rawLongitude.trim())
  ) {
    return null;
  }

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    name: optionalText(location.name),
    address: optionalText(location.address),
  };
}

export function formatLocationContent(location: IncomingLocation): string {
  return [location.name, location.address].filter(Boolean).join(" · ") || "Ubicación compartida";
}
