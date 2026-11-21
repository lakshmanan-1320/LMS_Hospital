/**
 * Dynamic placeholder extractor: extracts all {{variable}} tags
 */
export function extractEmailVariables(html: string): string[] {
  if (!html) return [];
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const matches = new Set<string>();
  let match;
  while ((match = regex.exec(html)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches);
}

/**
 * Safely renders HTML template with variables
 */
export function renderEmailTemplate(
  html: string,
  variables: Record<string, any> = {},
): string {
  if (!html) return '';
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return variables[key] !== undefined && variables[key] !== null
      ? String(variables[key])
      : '';
  });
}

/**
 * Strips HTML tags for plain-text fallback
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Ready-to-use modern responsive email starter presets
 */
export const STARTER_EMAIL_TEMPLATES = [
  {
    name: 'Platform Announcement',
    subject: 'Important Announcement: {{subject_headline}}',
    preview_text: 'Exciting new learning opportunities await you.',
    category: 'announcement',
    html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject_headline}}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #4f46e5; padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .content { padding: 32px 24px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
    .button { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 20px; text-align: center; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="header">
        <h1>Elevate Learning</h1>
      </div>
      <div class="content">
        <div class="greeting">Hello {{name}},</div>
        <p>We are thrilled to bring you the latest updates to accelerate your skill mastery and career growth.</p>
        <p>{{custom_message}}</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{action_url}}" class="button">Explore Dashboard</a>
        </div>
        <p style="font-size: 13px; color: #64748b;">If you have any questions or need guidance, reply directly to this email.</p>
      </div>
      <div class="footer">
        <p>&copy; {{current_year}} Elevate Learning LMS. All rights reserved.</p>
        <p>Sent to {{email}} because you are registered on our learning platform.</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: 'Course Promotion & Special Offer',
    subject: 'Special Offer: Boost your skills with {{course_title}}!',
    preview_text: 'Unlock exclusive learning perks today.',
    category: 'promotional',
    html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Special Offer</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .hero { background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%); padding: 40px 24px; text-align: center; color: #ffffff; }
    .badge { display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 4px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px; }
    .hero h1 { margin: 0; font-size: 26px; font-weight: 800; }
    .content { padding: 32px 24px; }
    .promo-box { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .promo-code { font-size: 22px; font-weight: 900; color: #4f46e5; letter-spacing: 2px; }
    .cta-btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 14px 32px; border-radius: 10px; font-weight: 800; font-size: 15px; text-decoration: none; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25); }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; background-color: #f8fafc; }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="hero">
        <span class="badge">Limited-Time Offer</span>
        <h1>Accelerate Your Mastery</h1>
      </div>
      <div class="content">
        <p style="font-size: 16px; font-weight: 600;">Hi {{name}},</p>
        <p>Take your skillset to the next level with our high-impact course: <strong>{{course_title}}</strong>.</p>
        <p>{{custom_message}}</p>
        <div class="promo-box">
          <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700;">Use Discount Code</div>
          <div class="promo-code">{{discount_code}}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Valid until the end of this week.</div>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{action_url}}" class="cta-btn">Claim Offer & Enroll Now</a>
        </div>
      </div>
      <div class="footer">
        <p>&copy; {{current_year}} Elevate Learning LMS. Sent to {{email}}.</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
  {
    name: 'Weekly Learning Digest',
    subject: 'Your Weekly Learning Roundup — Elevate LMS',
    preview_text: 'Curated articles, recommended courses, and new updates.',
    category: 'newsletter',
    html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Learning Digest</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #334155; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { padding: 28px 24px; border-bottom: 2px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 20px; font-weight: 900; color: #4f46e5; }
    .issue { font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
    .content { padding: 30px 24px; line-height: 1.6; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 16px; }
    .card h3 { margin: 0 0 8px 0; font-size: 16px; color: #0f172a; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="header">
        <div class="logo">ELEVATE INSIGHTS</div>
        <div class="issue">Weekly Digest</div>
      </div>
      <div class="content">
        <p>Hi {{name}}, here are this week's top learning highlights and curated recommendations for your journey.</p>
        <div class="card">
          <h3>Top Recommended Course</h3>
          <p style="margin: 0; font-size: 14px; color: #64748b;">{{featured_course_summary}}</p>
        </div>
        <div class="card">
          <h3>Community Updates</h3>
          <p style="margin: 0; font-size: 14px; color: #64748b;">{{custom_message}}</p>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <a href="{{action_url}}" style="color: #4f46e5; font-weight: 700; text-decoration: none; font-size: 14px;">Browse all courses &rarr;</a>
        </div>
      </div>
      <div class="footer">
        <p>&copy; {{current_year}} Elevate LMS. You received this because you are an active learner.</p>
      </div>
    </div>
  </div>
</body>
</html>`,
  },
];

