/**
 * Generates a professional HTML email from a PlanningEmail record.
 * Styled to match the Daily Planning Hub site colours.
 */
import type { PlanningEmail } from '@/types/planning.types';

/* ── Season tag data (mirrored from TagsSection) ─── */
const TAG_GROUPS: Record<string, string[]> = {
  'Dec-Feb': ['UV / Sun Protection', 'Hydration', 'Heat Stress Plan', 'Bushfire Risk', 'Storm Season Prep'],
  'Mar-May': ['Wet Weather PPE', 'Early Darkness', 'Fog / Visibility', 'Cool Start Protocol'],
  'Jun-Aug': ['Cold Start Protocol', 'Frost / Ice', 'Short Daylight', 'Wet Ground', 'Warm Layers PPE'],
  'Sep-Nov': ['Allergy / Hay Fever', 'Variable Weather', 'Increasing UV', 'Wind Gusts', 'Spring Storms'],
};

const SEASON_COLOURS: Record<string, { bg: string; text: string }> = {
  'Dec-Feb': { bg: '#EF4444', text: '#FFFFFF' },
  'Mar-May': { bg: '#22C55E', text: '#FFFFFF' },
  'Jun-Aug': { bg: '#3B82F6', text: '#FFFFFF' },
  'Sep-Nov': { bg: '#FACC15', text: '#1a1a2e' },
};

function getSeason(iso: string): string {
  try {
    const month = new Date(iso).getMonth();
    if (month >= 11 || month <= 1) return 'Dec-Feb';
    if (month >= 2 && month <= 4) return 'Mar-May';
    if (month >= 5 && month <= 7) return 'Jun-Aug';
    return 'Sep-Nov';
  } catch {
    return 'Sep-Nov';
  }
}

export function buildEmailSubject(plan: PlanningEmail): string {
  // Format date as dd-mm-yyyy for subject line
  let dateStr = plan.date;
  try {
    const d = new Date(plan.date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    dateStr = `${dd}-${mm}-${yyyy}`;
  } catch { /* keep raw */ }

  const parts = [
    'Daily Plan',
    dateStr,
    plan.projectNumber,
    plan.subjobCode,
  ].filter(Boolean);
  return parts.join(' – ');
}

export function buildEmailHtml(plan: PlanningEmail): string {
  /* ── Site colour tokens ─────────────────────────── */
  const PRIMARY   = '#0078D4';
  const PRIMARY_D = '#0060AA';
  const SUCCESS   = '#107C10';
  const SUCCESS_L = '#E6F5E6';
  const DANGER_L  = '#FCE6E7';
  const DANGER    = '#D13438';
  const BORDER    = '#E2E8F0';
  const BG_LIGHT  = '#F8FAFC';
  const HEADER_BG = '#F1F5F9';
  const TEXT_DARK  = '#0F172A';
  const TEXT_MED   = '#334155';
  const TEXT_LABEL = '#475569';
  const TEXT_MUTED = '#64748B';

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString('en-AU', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const esc = (s: string | undefined | null): string => {
    if (!s) return '—';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  const season = getSeason(plan.date);
  const seasonTags = TAG_GROUPS[season] ?? [];
  const seasonColour = SEASON_COLOURS[season] ?? SEASON_COLOURS['Sep-Nov'];

  /* ── Project details table ──────────────────────── */
  const details = [
    ['Date', formatDate(plan.date)],
    ['Project', plan.projectNumber],
    ['Sub Job', plan.subjobCode],
    ['Client', plan.client],
    ['Location', plan.location],
    ['Weather', plan.weather],
  ];
  const detailRows = details
    .map(([l, v]) =>
      `<tr><td style="padding:6px 12px;font-weight:600;color:${TEXT_LABEL};border:1px solid ${BORDER};width:120px;">${l}</td><td style="padding:6px 12px;color:${TEXT_DARK};border:1px solid ${BORDER};">${esc(v)}</td></tr>`)
    .join('');

  /* ── Check Your Tags ────────────────────────────── */
  const tagBadges = seasonTags
    .map((t) =>
      `<span style="display:inline-block;padding:5px 12px;margin:4px 6px 4px 0;border-radius:6px;font-size:12px;font-weight:600;background:${SUCCESS_L};color:${SUCCESS};border:1px solid #99D799;">${esc(t)}</span>`)
    .join(' ');

  /* ── QA Requirements ────────────────────────────── */
  let qaHtml = '';
  if (plan.qaRequirements?.length) {
    const rows = plan.qaRequirements.map((qa) => {
      const badgeBg = qa.completed ? SUCCESS_L : DANGER_L;
      const badgeCol = qa.completed ? SUCCESS : DANGER;
      const badgeText = qa.completed ? 'Done' : 'Pending';
      return `<tr>
        <td style="padding:6px 10px;border:1px solid ${BORDER};">${esc(qa.tool)}</td>
        <td style="padding:6px 10px;border:1px solid ${BORDER};">${esc(qa.item)}</td>
        <td style="padding:6px 10px;border:1px solid ${BORDER};">${esc(qa.assignedTo)}</td>
        <td style="padding:6px 10px;border:1px solid ${BORDER};text-align:center;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:${badgeBg};color:${badgeCol};">${badgeText}</span></td>
      </tr>`;
    }).join('');
    qaHtml = `
      <tr><td colspan="2" style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
          <tr><th style="padding:6px 10px;background:${HEADER_BG};border:1px solid ${BORDER};color:${TEXT_LABEL};text-align:left;">Tool</th><th style="padding:6px 10px;background:${HEADER_BG};border:1px solid ${BORDER};color:${TEXT_LABEL};text-align:left;">Item</th><th style="padding:6px 10px;background:${HEADER_BG};border:1px solid ${BORDER};color:${TEXT_LABEL};text-align:left;">Assigned To</th><th style="padding:6px 10px;background:${HEADER_BG};border:1px solid ${BORDER};color:${TEXT_LABEL};text-align:center;">Status</th></tr>
          ${rows}
        </table>
      </td></tr>`;
  }

  /* ── Crew Assignments ───────────────────────────── */
  let crewHtml = '';
  if (plan.crewAssignments?.length) {
    const rows = plan.crewAssignments.filter((c) => c.name).map((c) =>
      `<tr>
        <td style="padding:6px 10px;border:1px solid ${BORDER};">${esc(c.name)}</td>
        <td style="padding:6px 10px;border:1px solid ${BORDER};">${esc(c.startPoint)}</td>
        <td style="padding:6px 10px;border:1px solid ${BORDER};">${esc(c.startTime)}</td>
        <td style="padding:6px 10px;border:1px solid ${BORDER};">${esc(c.plant)}</td>
        <td style="padding:6px 10px;border:1px solid ${BORDER};">${esc(c.roles?.join(', '))}</td>
      </tr>`
    ).join('');
    if (rows) {
      crewHtml = `
        <tr><td colspan="2" style="padding:0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
            <tr><th style="padding:6px 10px;background:${HEADER_BG};border:1px solid ${BORDER};color:${TEXT_LABEL};text-align:left;">Name</th><th style="padding:6px 10px;background:${HEADER_BG};border:1px solid ${BORDER};color:${TEXT_LABEL};text-align:left;">Start Point</th><th style="padding:6px 10px;background:${HEADER_BG};border:1px solid ${BORDER};color:${TEXT_LABEL};text-align:left;">Start Time</th><th style="padding:6px 10px;background:${HEADER_BG};border:1px solid ${BORDER};color:${TEXT_LABEL};text-align:left;">Plant / Equipment</th><th style="padding:6px 10px;background:${HEADER_BG};border:1px solid ${BORDER};color:${TEXT_LABEL};text-align:left;">Roles</th></tr>
            ${rows}
          </table>
        </td></tr>`;
    }
  }

  /* ── Text sections ──────────────────────────────── */
  const textBlock = (text: string | undefined) =>
    text
      ? `<div style="font-size:13px;line-height:1.6;white-space:pre-wrap;color:${TEXT_MED};background:${BG_LIGHT};padding:12px;border-radius:6px;border:1px solid ${BORDER};">${esc(text)}</div>`
      : '';

  const sectionHeading = (title: string) =>
    `<div style="font-size:14px;font-weight:700;color:${TEXT_MED};text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid ${PRIMARY};padding-bottom:4px;margin:20px 0 10px;">${title}</div>`;

  /* ── Assemble email ─────────────────────────────── */
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Daily Plan</title>
</head>
<body style="margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif;color:${TEXT_DARK};background:#FFFFFF;">
<div style="max-width:700px;margin:0 auto;padding:0;">

  <!-- Header banner -->
  <div style="background:${PRIMARY};padding:18px 24px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:22px;color:#FFFFFF;font-weight:700;">Daily Planning Worksheet</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#CCE7FF;">GNB Energy &mdash; ${formatDate(plan.date)}</p>
  </div>

  <div style="padding:20px 24px;border:1px solid ${BORDER};border-top:none;border-radius:0 0 8px 8px;">

    <!-- Project Details -->
    ${sectionHeading('Project Details')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin-bottom:16px;">
      ${detailRows}
    </table>

    <!-- Check Your Tags -->
    <div style="background:${SUCCESS};padding:10px 16px;border-radius:6px 6px 0 0;text-align:center;">
      <span style="font-size:15px;font-weight:700;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">Check Your Tags</span>
    </div>
    <div style="padding:12px 16px;border:1px solid ${BORDER};border-top:none;border-radius:0 0 6px 6px;margin-bottom:16px;">
      <div style="margin-bottom:8px;">
        <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:${seasonColour.bg};color:${seasonColour.text};">${season}</span>
        <span style="font-size:12px;color:${TEXT_MUTED};margin-left:8px;">Season-specific safety tags for today's plan</span>
      </div>
      <div>${tagBadges}</div>
    </div>

    <!-- QA Requirements -->
    ${plan.qaRequirements?.length ? sectionHeading('QA Requirements') : ''}
    ${qaHtml ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">${qaHtml}</table>` : ''}

    <!-- Crew Assignments -->
    ${crewHtml ? sectionHeading('Crew Assignments') : ''}
    ${crewHtml ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">${crewHtml}</table>` : ''}

    <!-- Planned Work -->
    ${plan.plannedWork ? sectionHeading('Planned Work') + textBlock(plan.plannedWork) : ''}

    <!-- Materials -->
    ${plan.materials ? sectionHeading('Materials') + textBlock(plan.materials) : ''}

    <!-- Notes -->
    ${plan.notes ? sectionHeading('Notes') + textBlock(plan.notes) : ''}

    <!-- Footer -->
    <div style="margin-top:24px;padding-top:12px;border-top:1px solid ${BORDER};text-align:center;font-size:11px;color:${TEXT_MUTED};">
      Generated by <a href="https://planning.roseconnections.com.au" style="color:${PRIMARY_D};text-decoration:none;">Daily Planning Hub</a> &bull; ${new Date().toLocaleString('en-AU')}
    </div>

  </div>
</div>
</body>
</html>`;
}

