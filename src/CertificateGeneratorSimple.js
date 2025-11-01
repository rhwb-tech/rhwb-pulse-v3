import React, { useState } from "react";
import jsPDF from "jspdf";

export default function CertificateGeneratorSimple({ runner }) {
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(null);

  const generateCertificate = async () => {
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
          pdf.text(String(runner.time || ""), 842 * 0.875, 595 * 0.757, { align: "right" });

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
          pdf.text(String(runner.time || ""), 632, 500, { align: "center" });

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

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h3>Season 14 Certificate Generator</h3>
      <p>Generate a certificate for: <strong>{runner.name}</strong></p>
      <button
        onClick={generateCertificate}
        disabled={loading}
        style={{
          backgroundColor: "#0077ff",
          color: "white",
          border: "none",
          padding: "10px 20px",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      >
        {loading ? "Generating..." : "Generate Certificate"}
      </button>

      {url && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Certificate Options:</h4>
          
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
      )}
    </div>
  );
}
