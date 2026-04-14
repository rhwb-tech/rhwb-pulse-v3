import React, { useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Maps race_distance_completed values to template files in public/
const TEMPLATE_MAP = {
  '5K': '/5k certificate.pdf',
  '10K': '/10k certificate.pdf',
  'Half Marathon': '/half certificate.pdf',
  'Full Marathon': '/full certificate.pdf',
};

// Text positions as fractions of page dimensions.
// xFrac: fraction from left edge (0=left, 1=right)
// yFrac: fraction from TOP (0=top, 1=bottom) — converted to pdf-lib coords internally
// Tune these constants if text placement needs adjustment after visual testing.
const POS = {
  date: {
    xFrac: 0.868,   // left-aligned at start of DATE underline, top-right area
    yFrac: 0.318,
    size: 11,
  },
  runnerName: {
    xFrac: 0.640,   // center of the long name underline
    yFrac: 0.445,
    size: 20,
  },
  timing: {
    xFrac: 0.635,   // left edge of timing underline, after "YOUR OFFICIAL TIMING IS"
    yFrac: 0.625,
    size: 14,
  },
  prSuperscript: {
    size: 9,
    yOffset: 5,     // pts above timing baseline
  },
  coachName: {
    xFrac: 0.843,   // center under the "COACH" label, bottom-right
    yFrac: 0.900,
    size: 11,
  },
  // White rectangle to erase the hardcoded coach name baked into the template.
  // Covers from xFrac left edge, width = widthFrac of page, between yTopFrac and yBotFrac.
  coachCover: {
    xFrac: 0.700,
    widthFrac: 0.300,
    yTopFrac: 0.855,
    yBotFrac: 0.950,
  },
};

export default function CertificateGeneratorS15({ runner }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(null);

  const getTemplatePath = (distance) =>
    TEMPLATE_MAP[distance] || TEMPLATE_MAP['5K'];

  const formatDate = () =>
    new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const generateCertificate = async () => {
    if (!runner.time) return;
    setLoading(true);

    try {
      // Load the distance-appropriate PDF template
      const templatePath = getTemplatePath(runner.race);
      const existingPdfBytes = await fetch(encodeURI(templatePath)).then(r => r.arrayBuffer());
      const pdfDoc = await PDFDocument.load(existingPdfBytes);

      // Register fontkit on the document instance (must be per-document, not static)
      pdfDoc.registerFontkit(fontkit);

      const page = pdfDoc.getPages()[0];
      const { width, height } = page.getSize();

      // Coordinate helpers
      // px: fraction → x pts from left
      // py: fraction from top → y pts from bottom (pdf-lib origin is bottom-left)
      const px = (xFrac) => width * xFrac;
      const py = (yFrac) => height * (1 - yFrac);

      // Load custom fonts, fall back to Helvetica if not available in public/fonts/
      let fontBold, fontRegular;
      try {
        const bytes = await fetch('/fonts/Montserrat-Bold.ttf').then(r => r.arrayBuffer());
        fontBold = await pdfDoc.embedFont(bytes);
      } catch {
        fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      }
      try {
        const bytes = await fetch('/fonts/Montserrat-Regular.ttf').then(r => r.arrayBuffer());
        fontRegular = await pdfDoc.embedFont(bytes);
      } catch {
        fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      }

      const black = rgb(0, 0, 0);

      // 1. DATE — left-aligned at the start of the date underline
      const dateText = formatDate();
      page.drawText(dateText, {
        x: px(POS.date.xFrac),
        y: py(POS.date.yFrac),
        size: POS.date.size,
        font: fontRegular,
        color: black,
      });

      // 2. RUNNER NAME — centered on the long underline
      const nameText = runner.name || '';
      const nameWidth = fontBold.widthOfTextAtSize(nameText, POS.runnerName.size);
      page.drawText(nameText, {
        x: px(POS.runnerName.xFrac) - nameWidth / 2,
        y: py(POS.runnerName.yFrac),
        size: POS.runnerName.size,
        font: fontBold,
        color: black,
      });

      // 3. OFFICIAL TIMING — left-aligned at start of timing underline
      const timingText = String(runner.time || '');
      page.drawText(timingText, {
        x: px(POS.timing.xFrac),
        y: py(POS.timing.yFrac),
        size: POS.timing.size,
        font: fontBold,
        color: black,
      });

      // PR superscript — placed immediately after the timing text, correct width-based position
      if (runner.race_pr) {
        const timingWidth = fontBold.widthOfTextAtSize(timingText, POS.timing.size);
        page.drawText('PR', {
          x: px(POS.timing.xFrac) + timingWidth + 3,
          y: py(POS.timing.yFrac) + POS.prSuperscript.yOffset,
          size: POS.prSuperscript.size,
          font: fontBold,
          color: rgb(0.8, 0, 0),
        });
      }

      // 4. COACH NAME — erase hardcoded template name, draw dynamic value
      const coachText = (runner.coach || '').toUpperCase();
      if (coachText) {
        // White rectangle to blank out "SRIVATSAN SATHYAMURTHY" baked into the template
        const coverX = px(POS.coachCover.xFrac);
        const coverYBot = py(POS.coachCover.yBotFrac);
        const coverYTop = py(POS.coachCover.yTopFrac);
        page.drawRectangle({
          x: coverX,
          y: coverYBot,
          width: width * POS.coachCover.widthFrac,
          height: coverYTop - coverYBot,
          color: rgb(1, 1, 1),
        });

        // Draw dynamic coach name centered under the "COACH" label
        const coachWidth = fontBold.widthOfTextAtSize(coachText, POS.coachName.size);
        page.drawText(coachText, {
          x: px(POS.coachName.xFrac) - coachWidth / 2,
          y: py(POS.coachName.yFrac),
          size: POS.coachName.size,
          font: fontBold,
          color: black,
        });
      }

      // Save and create a blob URL for download/view/print
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setUrl(URL.createObjectURL(blob));

    } catch (error) {
      console.error('S15 certificate generation failed:', error);
      alert('Failed to generate certificate. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  // Revoke blob URL when the parent dialog closes (called via dialog onClose → component unmount)
  React.useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  // ── Post-generation: show action buttons ──────────────────────────────────
  if (url) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 16px 0', color: '#333' }}>Certificate Generated!</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = url;
              a.download = `${runner.name}-season15-certificate.pdf`;
              a.click();
            }}
            style={btnStyle('#28a745')}
          >
            💾 Save as PDF
          </button>
          <button
            onClick={() => window.open(url, '_blank')}
            style={btnStyle('#007bff')}
          >
            👁️ View PDF
          </button>
          <button
            onClick={() => {
              const w = window.open(url, '_blank');
              w.onload = () => w.print();
            }}
            style={btnStyle('#6c757d')}
          >
            🖨️ Print
          </button>
        </div>
      </div>
    );
  }

  // ── Pre-generation: show details + generate button ────────────────────────
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h3 style={{ marginBottom: '20px', color: '#333' }}>Season 15 Certificate Details</h3>

      <div style={detailsCardStyle}>
        <DetailRow label="Runner Name" value={runner.name || 'N/A'} />
        <DetailRow label="Race Distance" value={runner.race || 'N/A'} />
        <DetailRow
          label="Official Timing"
          value={
            runner.time ? (
              <span>
                {runner.time}
                {runner.race_pr && (
                  <span style={{ fontSize: '12px', verticalAlign: 'super', color: '#d32f2f', fontWeight: 'bold', marginLeft: '4px' }}>
                    PR
                  </span>
                )}
              </span>
            ) : (
              <span style={{ color: '#d32f2f', fontStyle: 'italic' }}>Not recorded</span>
            )
          }
        />
        <DetailRow
          label="Personal Record (PR)"
          value={
            <span style={{ color: runner.race_pr ? '#d32f2f' : '#666' }}>
              {runner.race_pr ? '✓ Yes – Personal Record!' : 'No'}
            </span>
          }
        />
        <DetailRow label="Coach" value={runner.coach || 'N/A'} last />
      </div>

      {!runner.time && (
        <div style={warningBoxStyle}>
          <p style={{ margin: 0, color: '#856404', fontSize: '15px', lineHeight: '1.5' }}>
            <strong>⚠️ Race Timing Not Available</strong>
            <br />
            Your race timing has not been recorded yet. Please check back later or contact your coach.
          </p>
        </div>
      )}

      <button
        onClick={generateCertificate}
        disabled={loading || !runner.time}
        style={{
          backgroundColor: runner.time ? '#28a745' : '#cccccc',
          color: 'white',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '8px',
          cursor: runner.time ? 'pointer' : 'not-allowed',
          fontSize: '16px',
          fontWeight: 'bold',
          opacity: runner.time ? 1 : 0.6,
        }}
      >
        {loading ? 'Generating…' : '✓ Generate Certificate'}
      </button>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function DetailRow({ label, value, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : '15px' }}>
      <strong style={{ color: '#666', display: 'block', marginBottom: '5px' }}>{label}:</strong>
      <span style={{ fontSize: '16px' }}>{value}</span>
    </div>
  );
}

const btnStyle = (bg) => ({
  backgroundColor: bg,
  color: 'white',
  border: 'none',
  padding: '8px 16px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
});

const detailsCardStyle = {
  backgroundColor: '#f5f5f5',
  padding: '20px',
  borderRadius: '8px',
  textAlign: 'left',
  maxWidth: '500px',
  margin: '0 auto 20px auto',
};

const warningBoxStyle = {
  backgroundColor: '#fff3cd',
  border: '1px solid #ffc107',
  borderRadius: '8px',
  padding: '15px',
  maxWidth: '500px',
  margin: '0 auto 20px auto',
};
