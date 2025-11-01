import React, { useState } from "react";
import jsPDF from "jspdf";

export default function CertificateGeneratorSimple({ runner }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(null);

  const generateCertificate = async () => {
    // Prevent generation if race timing is not available
    if (!runner.time) {
      console.warn("Cannot generate certificate: Race timing is not available");
      return;
    }
    
    setLoading(true);
    try {
      console.log("Starting certificate generation for runner:", runner);
      
      // Load the certificate template image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "/Half Marathon-01.jpg"; // local template

      img.onload = () => {
        console.log("Certificate template loaded successfully");
        console.log("Image dimensions:", img.width, "x", img.height);
        
        try {
          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "pt",
            format: "a4",
          });

          // Add the background template image (JPEG)
          pdf.addImage(img, "JPEG", 0, 0, 842, 595);

          // Only three dynamic fields per template
          pdf.setTextColor("#000000");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(25);
          pdf.text(runner.name, 421, 310, { align: "center" });

          pdf.setFontSize(22);
          pdf.text(String(runner.race || ""), 140, 440, { align: "center" });
          pdf.text(String(runner.time || ""), 682, 440, { align: "center" });

          // Coach name
          pdf.setFontSize(16);
          pdf.text(String(runner.coach || ""), 682, 640, { align: "center" });


          // Convert to blob and create URL for viewing/downloading
          const blob = pdf.output("blob");
          const url = URL.createObjectURL(blob);
          setUrl(url);
          
          // Certificate generated successfully - no popup needed
          
        } catch (error) {
          console.error("Error generating certificate:", error);
          console.error("Error generating certificate: " + error.message);
        } finally {
          setLoading(false);
        }
      };

      // Add timeout for image loading
      const imageTimeout = setTimeout(() => {
        console.log("Image loading timeout - using fallback design");
        // Template loading timeout - using fallback design
        generateFallbackCertificate();
      }, 5000); // 5 second timeout

      img.onload = () => {
        clearTimeout(imageTimeout);
        console.log("Certificate template loaded successfully");
        console.log("Image dimensions:", img.width, "x", img.height);
        
        try {
          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "pt",
            format: "a4",
          });

          // Add the background template image (JPEG)
          pdf.addImage(img, "JPEG", 0, 0, 842, 595);

          // Only three dynamic fields per template
          pdf.setTextColor("#000000");
          
          // Runner name: center aligned at 50% width, 50.2% height
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(48);
          pdf.text(runner.name, 842 * 0.50, 595 * 0.522, { align: "center" });

          // Race distance: left aligned at 21.2% width, 64.7% height
          pdf.setFont("helvetica", "normal"); // jsPDF doesn't have weight 600, using normal with semi-bold effect
          pdf.setFontSize(34);
          pdf.text(String(runner.race || ""), 842 * 0.040, 595 * 0.757, { align: "left" });

          // Official timing: right aligned at 77.3% width, 64.7% height
          const timingText = String(runner.time || "");
          const timingX = 842 * 0.875;
          const timingY = 595 * 0.757;
          pdf.text(timingText, timingX, timingY, { align: "right" });
          
          // Add PR superscript if race_pr is true
          if (runner.race_pr) {
            // Position PR as superscript: to the right of timing end, slightly above
            // Since timing is right-aligned, timingX is the right edge, so PR goes to the right
            const prX = timingX + 5; // Small gap after timing (to the right)
            const prY = timingY - 8; // Slightly above baseline for superscript effect
            pdf.setFontSize(20); // Smaller font for superscript
            pdf.text("PR", prX, prY);
            // Reset font size for next text
            pdf.setFontSize(34);
          }

          // Coach name: right aligned at 77.3% width, 84.2% height (using cursive font style)
          pdf.setFont("helvetica"); // Great Vibes is cursive, using italic as closest approximation
          pdf.setFontSize(30);
          pdf.text(String(runner.coach || ""), 842 * 0.943, 595 * 0.942, { align: "right" });


          // Convert to blob and create URL for viewing/downloading
          const blob = pdf.output("blob");
          const url = URL.createObjectURL(blob);
          setUrl(url);
          
          // Certificate generated successfully - no popup needed
          
        } catch (error) {
          console.error("Error generating certificate:", error);
          console.error("Error generating certificate: " + error.message);
        } finally {
          setLoading(false);
        }
      };

      img.onerror = (error) => {
        clearTimeout(imageTimeout);
        console.error("Error loading certificate template:", error);
        console.log("Attempted to load:", "/Half Marathon-01.jpg");
        console.log("Full URL would be:", window.location.origin + "/Half Marathon-01.jpg");
        // Error loading certificate template - using fallback design
        generateFallbackCertificate();
      };

      // Helper function for fallback certificate
      const generateFallbackCertificate = () => {
        try {
          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "pt",
            format: "a4",
          });

          // Minimal fallback without background, same positions
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, 842, 595, 'F');

          pdf.setTextColor("#000000");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(25);
          pdf.text(runner.name, 421, 240, { align: "center" });

          pdf.setFontSize(22);
          pdf.text(String(runner.race || ""), 210, 500, { align: "center" });
          
          // Timing with PR superscript if applicable
          const fallbackTimingText = String(runner.time || "");
          const fallbackTimingX = 632;
          const fallbackTimingY = 500;
          pdf.text(fallbackTimingText, fallbackTimingX, fallbackTimingY, { align: "center" });
          
          // Add PR superscript if race_pr is true
          if (runner.race_pr) {
            const fallbackTimingWidth = pdf.getTextWidth(fallbackTimingText);
            // Position PR as superscript: to the right of timing, slightly above
            const fallbackPrX = fallbackTimingX + (fallbackTimingWidth / 2) + 5; // Small gap after timing (center-aligned)
            const fallbackPrY = fallbackTimingY - 6; // Slightly above baseline for superscript effect
            pdf.setFontSize(16); // Smaller font for superscript
            pdf.text("PR", fallbackPrX, fallbackPrY);
            // Reset font size for next text
            pdf.setFontSize(22);
          }

          // Coach signature
          pdf.setFont("helvetica", "italic");
          pdf.setFontSize(18);
          pdf.text(String(runner.coach || ""), 632, 525, { align: "center" });

          // Coach name
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(25);
          pdf.text(String(runner.coach || ""), 632, 545, { align: "center" });

          // Convert to blob and create URL for viewing/downloading
          const blob = pdf.output("blob");
          const url = URL.createObjectURL(blob);
          setUrl(url);
          
          // Certificate generated with fallback design
          
        } catch (fallbackError) {
          console.error("Error in fallback certificate generation:", fallbackError);
          console.error("Error generating certificate: " + fallbackError.message);
        } finally {
          setLoading(false);
        }
      };
      
    } catch (error) {
      console.error("Error generating certificate:", error);
      console.error("Error generating certificate: " + error.message);
      setLoading(false);
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
