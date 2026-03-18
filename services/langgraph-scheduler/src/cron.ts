import type { PromptSchedule } from "./types.js";

const WEEKDAY_NAMES: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

interface RecentDueSlotInput {
  cronExpression: string;
  timeZone: string;
  now: Date;
  lookbackMinutes: number;
}

interface RecentDueSlot {
  slotKey: string;
  dateParts: ZonedDateParts;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function normalizeWeekday(value: number): number {
  return value === 7 ? 0 : value;
}

function parseNumber(
  value: string,
  min: number,
  max: number,
  normalize: (input: number) => number = (input) => input,
): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const normalized = normalize(parsed);
  if (normalized < min || normalized > max) {
    return null;
  }
  return normalized;
}

function parseRange(
  base: string,
  min: number,
  max: number,
  normalize: (input: number) => number,
): { start: number; end: number } | null {
  if (base === "*") {
    return { start: min, end: max };
  }

  if (base.includes("-")) {
    const [rawStart, rawEnd] = base.split("-", 2);
    if (rawStart === undefined || rawEnd === undefined) {
      return null;
    }
    const start = parseNumber(rawStart, min, max, normalize);
    const end = parseNumber(rawEnd, min, max, normalize);
    if (start === null || end === null || start > end) {
      return null;
    }
    return { start, end };
  }

  const single = parseNumber(base, min, max, normalize);
  if (single === null) {
    return null;
  }
  return { start: single, end: single };
}

function matchesSegment(
  segment: string,
  value: number,
  min: number,
  max: number,
  normalize: (input: number) => number = (input) => input,
): boolean {
  const [rawBase = "", rawStep] = segment.split("/", 2);
  const base = rawBase === "" ? "*" : rawBase;
  const range = parseRange(base, min, max, normalize);
  if (range === null) {
    return false;
  }
  if (value < range.start || value > range.end) {
    return false;
  }

  if (rawStep === undefined) {
    return true;
  }

  const step = Number.parseInt(rawStep, 10);
  if (!Number.isFinite(step) || step <= 0) {
    return false;
  }

  if (base !== "*" && !base.includes("-") && range.start === range.end) {
    return value >= range.start && (value - range.start) % step === 0;
  }

  return (value - range.start) % step === 0;
}

function matchesField(
  field: string,
  value: number,
  min: number,
  max: number,
  normalize: (input: number) => number = (input) => input,
): boolean {
  const segments = field.split(",");
  for (const segment of segments) {
    if (matchesSegment(segment.trim(), value, min, max, normalize)) {
      return true;
    }
  }
  return false;
}

function parseRequiredPart(value: string | undefined, partName: string): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Unable to parse ${partName} from zoned date`);
  }
  return parsed;
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  const weekday = WEEKDAY_NAMES[values.weekday ?? ""];
  if (weekday === undefined) {
    throw new Error(`Unable to parse weekday for timezone ${timeZone}`);
  }

  return {
    year: parseRequiredPart(values.year, "year"),
    month: parseRequiredPart(values.month, "month"),
    day: parseRequiredPart(values.day, "day"),
    hour: parseRequiredPart(values.hour, "hour"),
    minute: parseRequiredPart(values.minute, "minute"),
    weekday,
  };
}

function matchesDayFields(
  dayOfMonthField: string,
  dayOfWeekField: string,
  dateParts: ZonedDateParts,
): boolean {
  const dayOfMonthMatches = matchesField(dayOfMonthField, dateParts.day, 1, 31);
  const dayOfWeekMatches = matchesField(dayOfWeekField, dateParts.weekday, 0, 7, normalizeWeekday);

  if (dayOfMonthField === "*" && dayOfWeekField === "*") {
    return true;
  }
  if (dayOfMonthField === "*") {
    return dayOfWeekMatches;
  }
  if (dayOfWeekField === "*") {
    return dayOfMonthMatches;
  }
  return dayOfMonthMatches || dayOfWeekMatches;
}

function matchesCronExpression(cronExpression: string, dateParts: ZonedDateParts): boolean {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return false;
  }

  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = fields as [
    string,
    string,
    string,
    string,
    string,
  ];
  return (
    matchesField(minuteField, dateParts.minute, 0, 59) &&
    matchesField(hourField, dateParts.hour, 0, 23) &&
    matchesField(monthField, dateParts.month, 1, 12) &&
    matchesDayFields(dayOfMonthField, dayOfWeekField, dateParts)
  );
}

export function resolveModelCron(schedule: PromptSchedule, modelId: string): string {
  if (schedule.mode === "per_model") {
    const override = schedule.modelCrons?.[modelId];
    if (typeof override === "string" && override.trim() !== "") {
      return override.trim();
    }
  }
  return schedule.cron.trim();
}

export function getMostRecentDueSlot({
  cronExpression,
  timeZone,
  now,
  lookbackMinutes,
}: RecentDueSlotInput): RecentDueSlot | null {
  for (let offset = 0; offset <= lookbackMinutes; offset += 1) {
    const candidate = new Date(now.getTime() - offset * 60 * 1000);
    const dateParts = getZonedDateParts(candidate, timeZone);
    if (matchesCronExpression(cronExpression, dateParts)) {
      const slotKey =
        [dateParts.year, pad(dateParts.month), pad(dateParts.day)].join("") +
        "T" +
        [pad(dateParts.hour), pad(dateParts.minute)].join("");

      return {
        slotKey,
        dateParts,
      };
    }
  }

  return null;
}
