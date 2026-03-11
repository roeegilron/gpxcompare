import type { RawPoint, RiderTrack } from "../types/gpx";

function parseIsoMs(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function getFirstChildTextByLocalName(node: Element, localName: string): string | undefined {
  const child = Array.from(node.children).find((item) => item.localName === localName);
  return child?.textContent?.trim() || undefined;
}

export function parseGpxXmlString(
  xmlText: string,
  riderId: string,
  fileName: string
): RiderTrack {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  const parseError = xml.querySelector("parsererror");
  if (parseError) {
    throw new Error(`Invalid GPX: ${parseError.textContent ?? "parser error"}`);
  }

  const trackPoints = Array.from(xml.getElementsByTagNameNS("*", "trkpt"));
  if (trackPoints.length === 0) {
    throw new Error("GPX has no <trkpt> points");
  }

  const points: RawPoint[] = trackPoints.map((node, pointIndex) => {
    const lat = Number(node.getAttribute("lat"));
    const lon = Number(node.getAttribute("lon"));
    const eleText = getFirstChildTextByLocalName(node, "ele");
    const time = getFirstChildTextByLocalName(node, "time");

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`Invalid coordinate at point ${pointIndex}`);
    }

    return {
      riderId,
      pointIndex,
      lat,
      lon,
      ele: eleText ? Number(eleText) : undefined,
      time,
      timeMs: parseIsoMs(time)
    };
  });

  return { riderId, fileName, points };
}

export async function parseGpxFile(file: File, riderId: string): Promise<RiderTrack> {
  const xmlText = await file.text();
  return parseGpxXmlString(xmlText, riderId, file.name);
}
