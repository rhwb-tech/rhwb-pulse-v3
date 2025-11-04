import React, { useState } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Register fontkit globally for custom font embedding
// This must be done before creating any PDF documents
try {
  if (PDFDocument && typeof PDFDocument.registerFontkit === 'function') {
    PDFDocument.registerFontkit(fontkit);
  } else if (PDFDocument.prototype && typeof PDFDocument.prototype.registerFontkit === 'function') {
    PDFDocument.prototype.registerFontkit(fontkit);
  }
} catch (error) {
  // Fontkit registration failed, will use fallback fonts
}

export default function CertificateGeneratorSimple({ runner }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(null);

  // Helper function to load font from public folder
  const loadFont = async (fontPath) => {
    try {
      const response = await fetch(fontPath);
      const fontBytes = await response.arrayBuffer();
      return fontBytes;
    } catch (error) {
      throw error;
    }
  };

  // Helper function to calculate text width for centering/right alignment
  const calculateTextWidth = (text, font, fontSize) => {
    // Try to use pdf-lib's built-in width calculation if available
    try {
      if (font && typeof font.widthOfTextAtSize === 'function') {
        return font.widthOfTextAtSize(text, fontSize);
      }
    } catch (error) {
      // Using approximation for text width
    }
    
    // Fallback: Tighter approximation for Montserrat
    // Montserrat: reduce spacing significantly for more compact text
    const isCursive = fontSize === 36; // Great Vibes
    const avgCharWidth = isCursive ? fontSize * 0.60 : fontSize * 0.42; // Much tighter spacing
    
    // More accurate: account for spaces and character widths with tighter multipliers
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === ' ') {
        totalWidth += avgCharWidth * 0.2; // Spaces are narrower
      } else if (char.match(/[mwMWQOD]/)) {
        totalWidth += avgCharWidth * 1.1; // Wide characters (reduced multiplier)
      } else if (char.match(/[il1|]/)) {
        totalWidth += avgCharWidth * 0.2; // Narrow characters
      } else {
        totalWidth += avgCharWidth;
      }
    }
    
    return totalWidth;
  };

  // Helper function to calculate actual width when using tight spacing
  const calculateTightSpacingWidth = (text, font, fontSize, spacingReduction = 0.85) => {
    let totalWidth = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === ' ') {
        const spaceWidth = font.widthOfTextAtSize ? font.widthOfTextAtSize(' ', fontSize) : fontSize * 0.3;
        totalWidth += spaceWidth * 0.5;
        continue;
      }
      
      let charWidth;
      if (font.widthOfTextAtSize) {
        charWidth = font.widthOfTextAtSize(char, fontSize);
      } else {
        // Approximation based on character
        const avgWidth = fontSize * 0.42;
        if (char.match(/[mwMWQOD]/)) {
          charWidth = avgWidth * 1.1;
        } else if (char.match(/[il1|]/)) {
          charWidth = avgWidth * 0.2;
        } else {
          charWidth = avgWidth;
        }
      }
      
      totalWidth += charWidth * spacingReduction;
    }
    
    return totalWidth;
  };

  // Helper function to draw text with tighter letter spacing by rendering characters individually
  const drawTextWithTightSpacing = (page, text, x, y, font, fontSize, color, spacingReduction = 0.85) => {
    try {
      let currentX = x;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (char === ' ') {
          // Spaces get minimal reduction
          const spaceWidth = font.widthOfTextAtSize ? font.widthOfTextAtSize(' ', fontSize) : fontSize * 0.3;
          currentX += spaceWidth * 0.5;
          continue;
        }
        
        // Draw individual character
        page.drawText(char, {
          x: currentX,
          y: y,
          size: fontSize,
          font: font,
          color: color,
        });
        
        // Calculate width of this character and move to next position with reduced spacing
        let charWidth;
        if (font.widthOfTextAtSize) {
          charWidth = font.widthOfTextAtSize(char, fontSize);
        } else {
          // Approximation based on character
          const avgWidth = fontSize * 0.42;
          if (char.match(/[mwMWQOD]/)) {
            charWidth = avgWidth * 1.1;
          } else if (char.match(/[il1|]/)) {
            charWidth = avgWidth * 0.2;
          } else {
            charWidth = avgWidth;
          }
        }
        
        // Apply spacing reduction (0.85 = 15% tighter, adjust as needed)
        currentX += charWidth * spacingReduction;
      }
    } catch (error) {
      // Fallback to normal text drawing if character-by-character fails
      page.drawText(text, {
        x: x,
        y: y,
        size: fontSize,
        font: font,
        color: color,
      });
    }
  };

  const generateCertificate = async () => {
    // Prevent generation if race timing is not available
    if (!runner.time) {
      return;
    }
    
    setLoading(true);
    try {
      // Create a new PDF document (A4 landscape: 842 x 595 points)
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([842, 595]); // Landscape A4

      // Load the certificate template image
      const imgResponse = await fetch("/Half Marathon-01.jpg");
      const imgBytes = await imgResponse.arrayBuffer();
      const backgroundImage = await pdfDoc.embedJpg(imgBytes);

      // Embed the background image to cover the entire page
      page.drawImage(backgroundImage, {
        x: 0,
        y: 0,
        width: 842,
        height: 595,
      });

      // Load fonts (fonts should be in public/fonts/ folder)
      let montserratBold, montserratRegular, greatVibes;
      
      try {
        const montserratBoldBytes = await loadFont("/fonts/Montserrat-Bold.ttf");
        montserratBold = await pdfDoc.embedFont(montserratBoldBytes);
      } catch (error) {
        // Montserrat-Bold not found, using fallback
      }

      try {
        // Try Montserrat-Regular first, then fallback to variable font
        try {
          const montserratRegularBytes = await loadFont("/fonts/Montserrat-Regular.ttf");
          montserratRegular = await pdfDoc.embedFont(montserratRegularBytes);
        } catch (regularError) {
          // Try variable font as fallback
          const montserratVariableBytes = await loadFont("/fonts/Montserrat-VariableFont_wght.ttf");
          montserratRegular = await pdfDoc.embedFont(montserratVariableBytes);
        }
      } catch (error) {
        // Montserrat-Regular not found, using fallback
      }

      try {
        const greatVibesBytes = await loadFont("/fonts/GreatVibes-Regular.ttf");
        greatVibes = await pdfDoc.embedFont(greatVibesBytes);
      } catch (error) {
        // GreatVibes-Regular not found, using fallback
      }

      // Use default fonts as fallback if custom fonts are not available
      const fontBold = montserratBold || await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = montserratRegular || await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontCursive = greatVibes || await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      // Runner name: center aligned at 50% width, 52.2% height
      // pdf-lib coordinates: (0,0) is bottom-left, Y increases upward
      const runnerNameY = 595 - (595 * 0.522); // Convert from top to bottom coordinate
      const runnerNameX = 842 * 0.50;
      const runnerNameText = runner.name || "";
      
      // Calculate actual width with tight spacing (0.9) for proper centering
      const spacingReduction = 0.9;
      const runnerNameWidthActual = calculateTightSpacingWidth(runnerNameText, fontBold, 44, spacingReduction);
      const runnerNameStartX = runnerNameX - (runnerNameWidthActual / 2); // Center align
      drawTextWithTightSpacing(page, runnerNameText, runnerNameStartX, runnerNameY, fontBold, 44, rgb(0, 0, 0), spacingReduction);

      // Race distance: center aligned at 15% width, 75.7% height
      const raceDistanceY = 595 - (595 * 0.757);
      const raceDistanceCenterX = 842 * 0.15; // Center point for race distance (moved left)
      const raceDistanceText = String(runner.race || "");
      
      if (raceDistanceText) {
        // Use tight spacing (0.9) for race distance, same as runner name
        const raceSpacingReduction = 0.9;
        // Calculate actual width with tight spacing (0.9) for proper centering
        const raceDistanceWidthActual = calculateTightSpacingWidth(raceDistanceText, fontRegular, 28, raceSpacingReduction);
        const raceDistanceStartX = raceDistanceCenterX - (raceDistanceWidthActual / 2); // Center align
        drawTextWithTightSpacing(page, raceDistanceText, raceDistanceStartX, raceDistanceY, fontRegular, 28, rgb(0, 0, 0), raceSpacingReduction);
      }

      // Official timing: right aligned at 87.5% width, 75.7% height
      const timingText = String(runner.time || "");
      const timingX = 842 * 0.875;
      const timingY = 595 - (595 * 0.757);
      
      // Calculate actual width with tight spacing (0.9) for proper right alignment
      const timingSpacingReduction = 0.9;
      const timingWidthActual = calculateTightSpacingWidth(timingText, fontRegular, 28, timingSpacingReduction);
      const timingStartX = timingX - timingWidthActual; // Right align
      drawTextWithTightSpacing(page, timingText, timingStartX, timingY, fontRegular, 28, rgb(0, 0, 0), timingSpacingReduction);
      
      // Calculate center point of timing text for coach alignment
      const timingCenterX = timingStartX + (timingWidthActual / 2);

      // Add PR superscript if race_pr is true
      if (runner.race_pr) {
        const prX = timingX + 5; // Small gap after timing
        const prY = timingY + 8; // Slightly above baseline for superscript effect
        page.drawText("PR", {
          x: prX,
          y: prY,
          size: 20,
          font: fontRegular,
          color: rgb(0, 0, 0),
        });
      }

      // Coach signature and name: centered to race timings
      const coachText = String(runner.coach || "");
      
      if (coachText) {
        // Coach signature (cursive/Great Vibes) - one line up from original position
        const coachSignatureY = 595 - (595 * 0.942) + 25 + 10; // Move up one more line (~28 points for line height)
        const coachSignatureWidth = calculateTightSpacingWidth(coachText, fontCursive, 22, 0.9);
        const coachSignatureStartX = timingCenterX - (coachSignatureWidth / 2); // Center align to timing
        
        // Draw signature with tight spacing
        drawTextWithTightSpacing(page, coachText, coachSignatureStartX, coachSignatureY, fontCursive, 22, rgb(0, 0, 0), 0.9);
        
        // Coach name (bold) - below signature, centered to timing
        const coachNameY = 595 - (595 * 0.942); // Original position (below signature)
        const coachNameWidth = calculateTightSpacingWidth(coachText, fontBold, 22, 0.9);
        const coachNameStartX = timingCenterX - (coachNameWidth / 2); // Center align to timing
        
        // Draw name with tight spacing
        drawTextWithTightSpacing(page, coachText, coachNameStartX, coachNameY, fontBold, 22, rgb(0, 0, 0), 0.9);
      }

      // Save the PDF and create URL
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setUrl(url);
      
    } catch (error) {
      // Error generating certificate
      
      // Fallback certificate generation
      try {
        await generateFallbackCertificate();
      } catch (fallbackError) {
        // Error in fallback certificate generation
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function for fallback certificate
  const generateFallbackCertificate = async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([842, 595]);

      // White background
      page.drawRectangle({
        x: 0,
        y: 0,
        width: 842,
        height: 595,
        color: rgb(1, 1, 1),
      });

      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      // Runner name
      const runnerNameText = runner.name || "";
      const runnerNameWidth = calculateTextWidth(runnerNameText, fontBold, 36);
      page.drawText(runnerNameText, {
        x: 421 - (runnerNameWidth / 2),
        y: 595 - 240,
        size: 36,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      // Race distance
      const raceDistanceText = String(runner.race || "");
      if (raceDistanceText) {
        const raceWidth = calculateTextWidth(raceDistanceText, fontRegular, 22);
        page.drawText(raceDistanceText, {
          x: 210 - (raceWidth / 2),
          y: 595 - 500,
          size: 22,
          font: fontRegular,
          color: rgb(0, 0, 0),
        });
      }

      // Timing with PR superscript if applicable
      const fallbackTimingText = String(runner.time || "");
      if (fallbackTimingText) {
        const timingWidth = calculateTextWidth(fallbackTimingText, fontRegular, 22);
        page.drawText(fallbackTimingText, {
          x: 632 - (timingWidth / 2),
          y: 595 - 500,
          size: 22,
          font: fontRegular,
          color: rgb(0, 0, 0),
        });

        // Add PR superscript if race_pr is true
        if (runner.race_pr) {
          page.drawText("PR", {
            x: 632 + (timingWidth / 2) + 5,
            y: 595 - 494,
            size: 16,
            font: fontRegular,
            color: rgb(0, 0, 0),
          });
        }
      }

      // Coach
      const coachText = String(runner.coach || "");
      if (coachText) {
        const coachWidth = calculateTextWidth(coachText, fontItalic, 18);
        page.drawText(coachText, {
          x: 632 - (coachWidth / 2),
          y: 595 - 525,
          size: 18,
          font: fontItalic,
          color: rgb(0, 0, 0),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setUrl(url);
    } catch (fallbackError) {
      // Error in fallback certificate generation
      throw fallbackError;
    }
  };

  // Show certificate options if already generated, otherwise show confirmation
  if (url) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Certificate Generated Successfully!</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = url;
              a.download = `${runner.name}-season14-certificate.pdf`;
              a.click();
            }}
            style={{
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            💾 Save as PDF
          </button>
          
          <button
            onClick={() => window.open(url, '_blank')}
            style={{
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            👁️ View PDF
          </button>
          
          <button
            onClick={() => {
              const printWindow = window.open(url, '_blank');
              printWindow.onload = () => {
                printWindow.print();
              };
            }}
            style={{
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            🖨️ Print
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h3 style={{ marginBottom: '20px', color: '#333' }}>Certificate Details</h3>
      
      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        textAlign: 'left',
        maxWidth: '500px',
        margin: '0 auto 20px auto'
      }}>
        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#666', display: 'block', marginBottom: '5px' }}>Runner Name:</strong>
          <span style={{ fontSize: '16px' }}>{runner.name || 'N/A'}</span>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#666', display: 'block', marginBottom: '5px' }}>Race Distance:</strong>
          <span style={{ fontSize: '16px' }}>{runner.race || 'N/A'}</span>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#666', display: 'block', marginBottom: '5px' }}>Race Timing:</strong>
          {runner.time ? (
            <span style={{ fontSize: '16px' }}>
              {runner.time}
              {runner.race_pr && (
                <span style={{ 
                  fontSize: '12px', 
                  verticalAlign: 'super', 
                  color: '#d32f2f',
                  fontWeight: 'bold',
                  marginLeft: '4px'
                }}>PR</span>
              )}
            </span>
          ) : (
            <span style={{ fontSize: '16px', color: '#d32f2f', fontStyle: 'italic' }}>
              Not recorded
            </span>
          )}
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <strong style={{ color: '#666', display: 'block', marginBottom: '5px' }}>Personal Record (PR):</strong>
          <span style={{ fontSize: '16px', color: runner.race_pr ? '#d32f2f' : '#666' }}>
            {runner.race_pr ? '✓ Yes - This is a Personal Record!' : 'No'}
          </span>
        </div>
        
        <div>
          <strong style={{ color: '#666', display: 'block', marginBottom: '5px' }}>Coach:</strong>
          <span style={{ fontSize: '16px' }}>{runner.coach || 'N/A'}</span>
        </div>
      </div>

      {!runner.time && (
        <div style={{ 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '20px',
          maxWidth: '500px',
          margin: '0 auto 20px auto'
        }}>
          <p style={{ 
            margin: 0, 
            color: '#856404',
            fontSize: '15px',
            lineHeight: '1.5'
          }}>
            <strong>⚠️ Race Timing Not Available</strong>
            <br />
            Your race timing has not been recorded. Please contact your coach to update your race timing, and then check back later to generate your certificate.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={generateCertificate}
          disabled={loading || !runner.time}
          style={{
            backgroundColor: runner.time ? "#28a745" : "#cccccc",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            cursor: runner.time ? "pointer" : "not-allowed",
            fontSize: "16px",
            fontWeight: "bold",
            opacity: runner.time ? 1 : 0.6
          }}
        >
          {loading ? "Generating..." : "✓ Generate Certificate"}
        </button>
      </div>

    </div>
  );
}
