export const VARIABLE_SOURCES = [
  { value: 'recipient.name', label: 'Student / Registrant Full Name' },
  { value: 'recipient.firstName', label: 'First Name' },
  { value: 'recipient.phone', label: 'Phone Number' },
  { value: 'recipient.email', label: 'Email Address' },
  { value: 'webinar.title', label: 'Webinar Title' },
  { value: 'webinar.meeting_link', label: 'Meeting Join Link' },
  { value: 'webinar.start_time', label: 'Webinar Date & Time' },
  { value: 'course.title', label: 'Course Title' },
  { value: 'custom', label: 'Custom / Typed Value' },
];

export const COUNTRY_CODES = [
  { code: '971', name: 'UAE', flag: '🇦🇪' },
  { code: '966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '965', name: 'Kuwait', flag: '🇰🇼' },
  { code: '974', name: 'Qatar', flag: '🇶🇦' },
  { code: '968', name: 'Oman', flag: '🇴🇲' },
  { code: '973', name: 'Bahrain', flag: '🇧🇭' },
  { code: '91', name: 'India', flag: '🇮🇳' },
  { code: '44', name: 'UK', flag: '🇬🇧' },
  { code: '1', name: 'USA/Canada', flag: '🇺🇸' },
  { code: '65', name: 'Singapore', flag: '🇸🇬' },
  { code: '60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '61', name: 'Australia', flag: '🇦🇺' },
  { code: '49', name: 'Germany', flag: '🇩🇪' },
];

export function normalizeMobile(input: string | null | undefined, defaultCountryCode: string = '91'): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  const country = String(defaultCountryCode || '').replace(/\D/g, '');

  if (raw.startsWith('+')) {
    // already international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (country && digits.length === 11 && digits.startsWith('0')) {
    digits = country + digits.slice(1);
  } else if (country && digits.length === 10) {
    digits = country + digits;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export function detectCountry(phone: string | null | undefined): { code: string; name: string; flag: string } {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return { code: '', name: 'Unknown', flag: '🌐' };

  for (const entry of COUNTRY_CODES) {
    if (cleaned.startsWith(entry.code)) {
      return entry;
    }
  }
  return { code: cleaned.slice(0, 3), name: 'International', flag: '🌐' };
}

export function extractVariables(body: string): string[] {
  const keys = new Set<string>();
  const text = String(body || '');
  for (const match of text.matchAll(/##\s*([A-Za-z0-9_]+)\s*##/g)) keys.add(match[1]);
  for (const match of text.matchAll(/\{#?\s*([A-Za-z0-9_]+)\s*#?\}/g)) keys.add(match[1]);
  return [...keys];
}

export function humanizeKey(key: string): string {
  const match = /^var(\d+)$/i.exec(key);
  if (match) return `Variable ${match[1]}`;
  return String(key).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function guessSource(key: string): string {
  const k = String(key).toLowerCase();
  if (k.includes('webinar') || k.includes('session') || k.includes('event')) {
    if (k.includes('link') || k.includes('url')) return 'webinar.meeting_link';
    if (k.includes('time') || k.includes('date')) return 'webinar.start_time';
    return 'webinar.title';
  }
  if (k.includes('meeting') || k.includes('room') || k.includes('join')) return 'webinar.meeting_link';
  if (k.includes('time') || k.includes('date') || k.includes('start') || k.includes('schedule')) return 'webinar.start_time';
  if (k.includes('first') || k.includes('fname')) return 'recipient.firstName';
  if (k.includes('last') || k.includes('lname')) return 'recipient.lastName';
  if (k.includes('name') || k.includes('student') || k.includes('attendee')) return 'recipient.name';
  if (k.includes('course')) return 'course.title';
  return 'custom';
}

export function renderTemplate(body: string, values: Record<string, any> = {}): string {
  let str = String(body || '');
  // Replace ##variable##
  str = str.replace(/##\s*([A-Za-z0-9_]+)\s*##/g, (_, key) => {
    return values[key] !== undefined && values[key] !== null ? String(values[key]) : `##${key}##`;
  });
  // Replace {#var#} or {var}
  str = str.replace(/\{#?\s*([A-Za-z0-9_]+)\s*#?\}/g, (_, key) => {
    return values[key] !== undefined && values[key] !== null ? String(values[key]) : `{${key}}`;
  });
  return str;
}

export function calculateSmsParts(text: string): { chars: number; parts: number; isUnicode: boolean } {
  const str = String(text || '');
  const chars = str.length;
  // Non-GSM characters check (emojis, regional scripts)
  const isUnicode = /[^\u0000-\u007F]/.test(str);

  let parts = 1;
  if (isUnicode) {
    parts = chars <= 70 ? 1 : Math.ceil(chars / 67);
  } else {
    parts = chars <= 160 ? 1 : Math.ceil(chars / 153);
  }

  return { chars, parts, isUnicode };
}

