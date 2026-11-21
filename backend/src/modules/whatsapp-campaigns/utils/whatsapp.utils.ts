export function normalizeWhatsappPhone(phone: string, defaultCountry = '91'): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // If already prefixed with international country code (e.g. 919876543210 or 14155552671)
  if (digits.length > 10) {
    return digits;
  }
  // If 10 digits (typical for Indian mobile numbers)
  if (digits.length === 10) {
    return `${defaultCountry}${digits}`;
  }
  return digits;
}

export function extractTemplateVariableNumbers(bodyText: string): number[] {
  if (!bodyText) return [];
  const matches = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)];
  return [...new Set(matches.map((m) => Number(m[1])))].sort((a, b) => a - b);
}

export function renderTemplateText(
  bodyText: string,
  parameters: Record<string, string> | string[],
): string {
  if (!bodyText) return '';
  return bodyText.replace(/\{\{(\d+)\}\}/g, (_, indexStr) => {
    const num = Number(indexStr);
    if (Array.isArray(parameters)) {
      return parameters[num - 1] ?? `{{${num}}}`;
    }
    return parameters[indexStr] ?? parameters[String(num)] ?? `{{${num}}}`;
  });
}

