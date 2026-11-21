import * as XLSX from 'xlsx';

/**
 * Parses an uploaded Excel (.xlsx, .xls) or CSV file into an array of row objects.
 * @param {File} file 
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('No file provided'));
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Read first sheet
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          return resolve([]);
        }
        
        const worksheet = workbook.Sheets[firstSheetName];
        // Convert to array of objects, treating all cell values as trimmed strings
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
        
        // Clean keys: trim and strip non-breaking spaces
        const cleanedRows = json.map((row) => {
          const cleanedRow = {};
          for (const key of Object.keys(row)) {
            const cleanKey = String(key).trim();
            cleanedRow[cleanKey] = typeof row[key] === 'string' ? row[key].trim() : String(row[key] ?? '');
          }
          return cleanedRow;
        });

        resolve(cleanedRows);
      } catch (err) {
        reject(new Error(`Failed to parse spreadsheet: ${err.message}`));
      }
    };

    reader.onerror = (err) => reject(new Error('File reading failed.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Export JSON array to styled downloadable Excel file.
 * @param {Array<Record<string, any>>} data 
 * @param {string} fileName 
 * @param {string} sheetName 
 */
export function exportToExcel(data, fileName = 'export.xlsx', sheetName = 'Data') {
  if (!data || !data.length) {
    throw new Error('No data available to export.');
  }

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-calculate column widths
  const keys = Object.keys(data[0] || {});
  const colWidths = keys.map((key) => {
    const maxLen = data.reduce((max, row) => {
      const val = String(row[key] ?? '');
      return Math.max(max, val.length);
    }, key.length);
    return { wch: Math.min(Math.max(maxLen + 3, 12), 50) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeFileName = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(workbook, safeFileName);
}

/**
 * Validates email format.
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

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

export function detectCountry(phone) {
  const cleaned = String(phone || '').replace(/\D/g, '');
  if (!cleaned) return { code: '', name: 'Unknown', flag: '🌐' };

  for (const entry of COUNTRY_CODES) {
    if (cleaned.startsWith(entry.code)) {
      return entry;
    }
  }
  return { code: cleaned.slice(0, 3), name: 'International', flag: '🌐' };
}

/**
 * Normalizes phone number into E.164 digits format (10-15 digits).
 */
export function normalizePhone(rawPhone, defaultCountry = '91') {
  if (!rawPhone) return null;
  const raw = String(rawPhone).trim();
  let digits = raw.replace(/\D/g, '');
  const country = String(defaultCountry || '91').replace(/\D/g, '');

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

/**
 * Auto-detects Email and Name headers from row keys.
 */
export function detectEmailHeaders(row) {
  const keys = Object.keys(row);
  const emailRegex = /^(email|e-mail|mail|email_address|emailaddress|recipient_email)$/i;
  const nameRegex = /^(name|full_name|fullname|recipient_name|student_name|first_name|firstname)$/i;

  let emailKey = keys.find((k) => emailRegex.test(k.trim()));
  let nameKey = keys.find((k) => nameRegex.test(k.trim()));

  // Fallback: search substring if exact match not found
  if (!emailKey) {
    emailKey = keys.find((k) => k.toLowerCase().includes('email') || k.toLowerCase().includes('mail'));
  }
  if (!nameKey) {
    nameKey = keys.find((k) => k.toLowerCase().includes('name'));
  }

  return { emailKey, nameKey };
}

/**
 * Auto-detects Phone and Name headers from row keys.
 */
export function detectPhoneHeaders(row) {
  const keys = Object.keys(row);
  const phoneRegex = /^(phone|mobile|contact|phone_number|phonenumber|mobile_number|mobilenumber|cell|whatsapp|number)$/i;
  const nameRegex = /^(name|full_name|fullname|recipient_name|student_name|first_name|firstname)$/i;

  let phoneKey = keys.find((k) => phoneRegex.test(k.trim()));
  let nameKey = keys.find((k) => nameRegex.test(k.trim()));

  if (!phoneKey) {
    phoneKey = keys.find((k) => k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile') || k.toLowerCase().includes('contact'));
  }
  if (!nameKey) {
    nameKey = keys.find((k) => k.toLowerCase().includes('name'));
  }

  return { phoneKey, nameKey };
}

/**
 * Generates and downloads a sample Excel template for Email Campaigns.
 * @param {Array<string>} templateVariables 
 */
export function downloadSampleEmailTemplate(templateVariables = []) {
  const customCols = templateVariables.filter(
    (v) => !['name', 'first_name', 'last_name', 'email', 'current_year'].includes(v.toLowerCase())
  );

  const sampleRow1 = {
    Name: 'Sarah Connor',
    Email: 'sarah.connor@example.com',
    Company: 'Cyberdyne Systems',
    Role: 'Lead Engineer',
  };

  const sampleRow2 = {
    Name: 'Alex Johnson',
    Email: 'alex.johnson@example.com',
    Company: 'Elevate Learning',
    Role: 'Student',
  };

  // Add custom template columns if provided
  for (const v of customCols) {
    sampleRow1[v] = `Sample ${v}`;
    sampleRow2[v] = `Value ${v}`;
  }

  exportToExcel([sampleRow1, sampleRow2], 'Email_Recipients_Template.xlsx', 'Recipients');
}

/**
 * Generates and downloads a sample Excel template for SMS Campaigns.
 * @param {Array<string>} templateVariables 
 */
export function downloadSampleSmsTemplate(templateVariables = []) {
  const customCols = templateVariables.filter(
    (v) => !['name', 'first_name', 'last_name', 'phone', 'mobile'].includes(v.toLowerCase())
  );

  const sampleRow1 = {
    Name: 'Sarah Connor',
    Phone: '+919876543210',
  };

  const sampleRow2 = {
    Name: 'Alex Johnson',
    Phone: '+919812345678',
  };

  for (const v of customCols) {
    sampleRow1[v] = `Sample ${v}`;
    sampleRow2[v] = `Value ${v}`;
  }

  exportToExcel([sampleRow1, sampleRow2], 'SMS_Recipients_Template.xlsx', 'Recipients');
}

/**
 * Generates and downloads a sample Excel template for WhatsApp Campaigns.
 * Supports template variables like {{1}}, {{2}} mapped to columns.
 * @param {Array<string>} templateVariables 
 */
export function downloadSampleWhatsappTemplate(templateVariables = []) {
  const sampleRow1 = {
    Name: 'Sarah Connor',
    Phone: '+919876543210',
  };

  const sampleRow2 = {
    Name: 'Alex Johnson',
    Phone: '+919812345678',
  };

  if (templateVariables && templateVariables.length > 0) {
    templateVariables.forEach((v, idx) => {
      const colName = `Var_${v}`;
      sampleRow1[colName] = `Value ${idx + 1}`;
      sampleRow2[colName] = `Sample ${idx + 1}`;
    });
  } else {
    sampleRow1['Var_1'] = 'React Masterclass';
    sampleRow1['Var_2'] = 'Saturday 10 AM';
    sampleRow2['Var_1'] = 'Fullstack TypeScript';
    sampleRow2['Var_2'] = 'Sunday 4 PM';
  }

  exportToExcel([sampleRow1, sampleRow2], 'WhatsApp_Recipients_Template.xlsx', 'Recipients');
}
