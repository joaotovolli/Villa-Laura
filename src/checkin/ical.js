const unfoldLines = (input) =>
  String(input || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .reduce((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);

const decodeText = (value = "") =>
  value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");

const parseDateValue = (value) => {
  if (!value) return null;
  const clean = value.trim();
  if (/^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return clean;
};

const daysBetween = (start, end) => {
  if (!start || !end) return 0;
  const startDate = Date.parse(`${start}T00:00:00Z`);
  const endDate = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) return 0;
  return Math.max(0, Math.round((endDate - startDate) / 86400000));
};

const extractReservationUrl = (text) => {
  const match = String(text || "").match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0].replace(/[),.;]+$/, "") : "";
};

const extractReservationCode = (url) => {
  if (!url) return "";
  const decoded = decodeURIComponent(url);
  const candidates = [
    decoded.match(/reservation(?:s|_details)?\/([A-Z0-9-]{6,})/i),
    decoded.match(/[?&](?:code|confirmation_code|reservation_code)=([A-Z0-9-]{6,})/i),
    decoded.match(/\b(HM[A-Z0-9]{6,})\b/i)
  ];
  return (candidates.find(Boolean)?.[1] || "").toUpperCase();
};

const extractPhoneLast4 = (text) => {
  const compact = String(text || "").replace(/[^\d+]/g, " ");
  const matches = compact.match(/\d[\d\s]{6,}\d/g) || [];
  const candidate = matches.map((entry) => entry.replace(/\D/g, "")).find((entry) => entry.length >= 7);
  return candidate ? candidate.slice(-4) : "";
};

const classifySummary = (summary) => {
  const normalized = String(summary || "").trim().toLowerCase();
  if (normalized.includes("not available")) return "blocked";
  if (normalized === "reserved" || normalized.includes("reserved")) return "reservation";
  return "unknown";
};

export const parseAirbnbIcal = (icalText) => {
  const lines = unfoldLines(icalText);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const index = line.indexOf(":");
    if (index === -1) continue;
    const rawName = line.slice(0, index);
    const name = rawName.split(";")[0].toUpperCase();
    current[name] = decodeText(line.slice(index + 1));
  }

  const seen = new Set();
  return events
    .filter((event) => event.UID && !seen.has(event.UID) && seen.add(event.UID))
    .map((event) => {
      const description = event.DESCRIPTION || "";
      const reservationUrl = extractReservationUrl(description);
      const checkIn = parseDateValue(event.DTSTART);
      const checkOut = parseDateValue(event.DTEND);
      return {
        uid: event.UID,
        summary: event.SUMMARY || "",
        type: classifySummary(event.SUMMARY),
        status: classifySummary(event.SUMMARY) === "blocked" ? "blocked" : "imported",
        checkIn,
        checkOut,
        nights: daysBetween(checkIn, checkOut),
        dtstamp: event.DTSTAMP || "",
        description,
        reservationUrl,
        reservationCode: extractReservationCode(reservationUrl || description),
        phoneLast4: extractPhoneLast4(description),
        source: "Airbnb"
      };
    });
};

export const __icalTest = {
  daysBetween,
  extractPhoneLast4,
  extractReservationCode,
  extractReservationUrl
};
