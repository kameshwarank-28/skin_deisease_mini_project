import React from 'react';

/**
 * DoodleBackground
 * 
 * Renders hand-crafted vector line-art doodles specifically themed for:
 * - Patient: Skin health, hydration, SPF/sun care, moisturizing, healing bandages, wellness, clean glow.
 * - Doctor: Stethoscopes, microscopes, Rx prescription pads, dermatoscope, syringes, pills, ECG, clinical charts.
 * 
 * Anchored to the outer margins (left and right edges) so that they fill
 * the empty background space across all pages without ever intruding underneath
 * the main operating content or cards.
 */
export default function DoodleBackground({
  role = 'patient',
  dim = false,
  isWorkspace = false,
  sidebarWidth = 0
}) {
  const isDoctor = role === 'doctor';
  const opacity = dim ? 0.16 : 0.42;
  const accentOpacity = dim ? 0.13 : 0.36;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: isWorkspace ? 64 : 0,
        left: isWorkspace ? sidebarWidth : 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease'
      }}
    >
      <style>{`
        @keyframes doodleFloatSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-7px) rotate(1.2deg); }
        }
        @keyframes doodleFloatAlt {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(8px) rotate(-1.2deg); }
        }
        .doodle-item-float-1 {
          animation: doodleFloatSlow 7.5s ease-in-out infinite;
        }
        .doodle-item-float-2 {
          animation: doodleFloatAlt 9s ease-in-out infinite;
        }
        .doodle-item-float-3 {
          animation: doodleFloatSlow 6.5s ease-in-out infinite;
          animation-delay: 1.5s;
        }
        .doodle-item-float-4 {
          animation: doodleFloatAlt 9.5s ease-in-out infinite;
          animation-delay: 2s;
        }
      `}</style>

      {/* Login Page Watermark Header Badges (Hidden in Workspace) */}
      {!isWorkspace && (
        <>
          <div style={{
            position: 'absolute',
            top: 28,
            left: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: 0.45,
            color: '#10254C',
            fontSize: '0.85rem',
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#1177DE'
            }} />
            {isDoctor ? 'Clinical Dermatology Suite' : 'Patient Skin Health Space'}
          </div>

          <div style={{
            position: 'absolute',
            bottom: 24,
            right: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: 0.45,
            color: '#10254C',
            fontSize: '0.8rem',
            fontWeight: 600
          }}>
            {isDoctor ? '🩺 DermAI Diagnostic Decision Support' : '✨ DermAI Daily Skin Care & Monitoring'}
          </div>
        </>
      )}

      {isDoctor ? (
        /* =========================================================
           DOCTOR DOODLES: Anchored strictly to outer margins
           ========================================================= */
        <div key="doctor-doodles" style={{ position: 'absolute', inset: 0 }}>
          {/* Left Margin - Top: Stethoscope */}
          <div className="doodle-item-float-1" style={{ position: 'absolute', top: '5%', left: '2%', opacity }}>
            <svg width="135" height="135" viewBox="0 0 120 120" fill="none" stroke="#1177DE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="34" cy="22" r="3.5" fill="#1177DE" />
              <circle cx="66" cy="22" r="3.5" fill="#1177DE" />
              <path d="M34 26 C34 44 48 56 50 64" />
              <path d="M66 26 C66 44 52 56 50 64" />
              <path d="M50 64 L50 78" />
              <path d="M50 78 C50 96 74 98 78 84 C82 70 94 72 96 86 C97 96 90 104 80 104 C74 104 68 100 68 94" />
              <circle cx="68" cy="94" r="10" stroke="#0000FF" strokeWidth="2.4" fill="rgba(17, 119, 222, 0.12)" />
              <circle cx="68" cy="94" r="5" stroke="#1177DE" strokeWidth="1.8" />
              {!dim && <text x="60" y="116" fill="#10254C" fontSize="9" fontWeight="bold">Stethoscope</text>}
            </svg>
          </div>

          {/* Left Margin - Mid: Dermatoscope Tool */}
          <div className="doodle-item-float-3" style={{ position: 'absolute', top: '36%', left: '2.5%', opacity }}>
            <svg width="110" height="110" viewBox="0 0 100 100" fill="none" stroke="#1177DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="22" y="52" width="14" height="42" rx="3" transform="rotate(-40 22 52)" fill="rgba(17, 119, 222, 0.12)" />
              <circle cx="64" cy="28" r="20" stroke="#10254C" strokeWidth="2.4" fill="rgba(68, 142, 226, 0.15)" />
              <circle cx="64" cy="28" r="14" stroke="#1177DE" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx="64" cy="17" r="1.5" fill="#1177DE" />
              <circle cx="75" cy="28" r="1.5" fill="#1177DE" />
              <circle cx="64" cy="39" r="1.5" fill="#1177DE" />
              <circle cx="53" cy="28" r="1.5" fill="#1177DE" />
              <line x1="64" y1="23" x2="64" y2="33" stroke="#0000FF" strokeWidth="1.2" />
              <line x1="59" y1="28" x2="69" y2="28" stroke="#0000FF" strokeWidth="1.2" />
            </svg>
          </div>

          {/* Left Margin - Lower-Mid: Vitals Clipboard */}
          <div className="doodle-item-float-4" style={{ position: 'absolute', top: '65%', left: '2%', opacity: accentOpacity }}>
            <svg width="90" height="100" viewBox="0 0 90 100" fill="none" stroke="#10254C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="14" y="16" width="62" height="76" rx="5" fill="#ffffff" stroke="#1177DE" strokeWidth="2" />
              <rect x="32" y="10" width="26" height="10" rx="3" fill="#10254C" />
              <polyline points="24,36 30,42 44,28" stroke="#1177DE" strokeWidth="2.2" />
              <line x1="48" y1="36" x2="68" y2="36" stroke="#7CB0EA" strokeWidth="1.8" />
              <polyline points="24,56 30,62 44,48" stroke="#1177DE" strokeWidth="2.2" />
              <line x1="48" y1="56" x2="68" y2="56" stroke="#7CB0EA" strokeWidth="1.8" />
              <polyline points="24,76 30,82 44,68" stroke="#1177DE" strokeWidth="2.2" />
              <line x1="48" y1="76" x2="68" y2="76" stroke="#7CB0EA" strokeWidth="1.8" />
            </svg>
          </div>

          {/* Left Margin - Bottom: Laboratory Microscope */}
          <div className="doodle-item-float-2" style={{ position: 'absolute', bottom: '5%', left: '2%', opacity }}>
            <svg width="140" height="140" viewBox="0 0 130 130" fill="none" stroke="#10254C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="36" y="18" width="16" height="24" rx="2" transform="rotate(-30 36 18)" fill="rgba(68, 142, 226, 0.15)" stroke="#1177DE" strokeWidth="2" />
              <line x1="45" y1="36" x2="62" y2="60" stroke="#1177DE" strokeWidth="4" />
              <circle cx="62" cy="62" r="7" fill="#1177DE" />
              <line x1="62" y1="69" x2="60" y2="80" stroke="#0000FF" strokeWidth="3" />
              <line x1="66" y1="67" x2="72" y2="76" stroke="#0000FF" strokeWidth="2" />
              <path d="M54 44 C82 46 94 70 86 96 L80 110" stroke="#10254C" strokeWidth="3.2" />
              <circle cx="78" cy="74" r="5.5" fill="#1177DE" stroke="#10254C" />
              <circle cx="78" cy="74" r="2.5" fill="#ffffff" />
              <line x1="38" y1="84" x2="80" y2="84" stroke="#10254C" strokeWidth="3" />
              <rect x="52" y="81" width="16" height="3" fill="#448EE2" />
              <path d="M54 90 C54 98 68 98 68 90 Z" fill="rgba(17, 119, 222, 0.2)" stroke="#1177DE" />
              <path d="M30 116 L96 116 C96 116 94 110 80 110 L44 110 C32 110 30 116 30 116 Z" fill="rgba(16, 37, 76, 0.1)" stroke="#10254C" strokeWidth="2.5" />
            </svg>
          </div>

          {/* Right Margin - Top: Prescription Rx Pad */}
          <div className="doodle-item-float-1" style={{ position: 'absolute', top: '5%', right: '2%', opacity }}>
            <svg width="130" height="140" viewBox="0 0 110 120" fill="none" stroke="#10254C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="18" y="14" width="74" height="94" rx="6" fill="#ffffff" stroke="#1177DE" strokeWidth="2.2" />
              <path d="M38 14 L38 22 C38 24 40 26 42 26 L68 26 C70 26 72 24 72 22 L72 14" fill="#10254C" stroke="#10254C" />
              <text x="26" y="52" fill="#0000FF" fontSize="24" fontWeight="bold" fontFamily="Georgia, serif">Rx</text>
              <line x1="54" y1="42" x2="82" y2="42" stroke="#448EE2" strokeWidth="2" />
              <line x1="54" y1="48" x2="76" y2="48" stroke="#7CB0EA" strokeWidth="1.8" />
              <line x1="28" y1="64" x2="82" y2="64" stroke="#7CB0EA" strokeWidth="1.5" />
              <line x1="28" y1="72" x2="82" y2="72" stroke="#7CB0EA" strokeWidth="1.5" />
              <line x1="28" y1="80" x2="68" y2="80" stroke="#7CB0EA" strokeWidth="1.5" />
              <path d="M48 94 Q56 86 64 92 T78 90" stroke="#1177DE" strokeWidth="1.8" fill="none" />
              <line x1="44" y1="98" x2="82" y2="98" stroke="#10254C" strokeWidth="1.2" />
            </svg>
          </div>

          {/* Right Margin - Mid: ECG Rhythm & Heart */}
          <div className="doodle-item-float-2" style={{ position: 'absolute', top: '36%', right: '2.5%', opacity }}>
            <svg width="125" height="80" viewBox="0 0 130 80" fill="none" stroke="#1177DE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M65 30 C58 10 32 10 32 30 C32 46 65 65 65 65 C65 65 98 46 98 30 C98 10 72 10 65 30 Z" fill="rgba(17, 119, 222, 0.08)" stroke="#7CB0EA" strokeWidth="1.8" strokeDasharray="3 3" />
              <path d="M8 45 L34 45 L40 38 L44 52 L50 14 L56 68 L62 42 L68 48 L74 45 L122 45" stroke="#0000FF" strokeWidth="2.5" />
              <circle cx="50" cy="14" r="3" fill="#1177DE" />
            </svg>
          </div>

          {/* Right Margin - Lower-Mid: DNA Double Helix */}
          <div className="doodle-item-float-3" style={{ position: 'absolute', top: '65%', right: '2%', opacity: accentOpacity }}>
            <svg width="80" height="90" viewBox="0 0 80 90" fill="none" stroke="#1177DE" strokeWidth="2" strokeLinecap="round">
              <path d="M22 10 C34 26 46 38 58 54 C46 70 34 82 22 90" />
              <path d="M58 10 C46 26 34 38 22 54 C34 70 46 82 58 90" stroke="#10254C" />
              <line x1="28" y1="20" x2="52" y2="20" stroke="#448EE2" strokeWidth="2" />
              <line x1="38" y1="36" x2="42" y2="36" stroke="#448EE2" strokeWidth="2" />
              <line x1="26" y1="56" x2="54" y2="56" stroke="#448EE2" strokeWidth="2" />
              <line x1="32" y1="74" x2="48" y2="74" stroke="#448EE2" strokeWidth="2" />
            </svg>
          </div>

          {/* Right Margin - Bottom: Syringe & Medicine Ampoule */}
          <div className="doodle-item-float-4" style={{ position: 'absolute', bottom: '5%', right: '2%', opacity }}>
            <svg width="135" height="135" viewBox="0 0 120 120" fill="none" stroke="#1177DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <g transform="rotate(-35 60 60)">
                <line x1="60" y1="12" x2="60" y2="28" stroke="#10254C" strokeWidth="1.8" />
                <line x1="52" y1="12" x2="68" y2="12" stroke="#10254C" strokeWidth="2.5" />
                <rect x="52" y="28" width="16" height="54" rx="2" fill="rgba(17, 119, 222, 0.12)" stroke="#1177DE" strokeWidth="2.2" />
                <line x1="62" y1="38" x2="68" y2="38" stroke="#1177DE" strokeWidth="1.5" />
                <line x1="60" y1="46" x2="68" y2="46" stroke="#1177DE" strokeWidth="1.5" />
                <line x1="62" y1="54" x2="68" y2="54" stroke="#1177DE" strokeWidth="1.5" />
                <line x1="60" y1="62" x2="68" y2="62" stroke="#1177DE" strokeWidth="1.5" />
                <path d="M57 82 L60 88 L63 82" fill="#1177DE" />
                <line x1="60" y1="88" x2="60" y2="108" stroke="#10254C" strokeWidth="1.5" />
                <circle cx="60" cy="112" r="2" fill="#0000FF" />
              </g>
              <rect x="74" y="66" width="28" height="42" rx="4" fill="rgba(68, 142, 226, 0.15)" stroke="#10254C" strokeWidth="2.2" />
              <rect x="80" y="58" width="16" height="8" rx="2" fill="#1177DE" stroke="#10254C" strokeWidth="1.8" />
              <rect x="80" y="74" width="16" height="18" fill="#ffffff" stroke="#7CB0EA" strokeWidth="1.2" />
              <path d="M88 78 L88 88 M83 83 L93 83" stroke="#0000FF" strokeWidth="1.8" />
            </svg>
          </div>

          {/* Accent Crosses in Margins */}
          <div style={{ position: 'absolute', top: '22%', left: '3%', opacity: accentOpacity }}>
            <svg width="28" height="28" viewBox="0 0 30 30" fill="none" stroke="#1177DE" strokeWidth="2.5">
              <path d="M15 5 L15 25 M5 15 L25 15" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ position: 'absolute', top: '80%', left: '3.5%', opacity: accentOpacity }}>
            <svg width="26" height="26" viewBox="0 0 30 30" fill="none" stroke="#0000FF" strokeWidth="2.5">
              <path d="M15 5 L15 25 M5 15 L25 15" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ position: 'absolute', top: '22%', right: '3%', opacity: accentOpacity }}>
            <svg width="28" height="28" viewBox="0 0 30 30" fill="none" stroke="#10254C" strokeWidth="2.5">
              <path d="M15 5 L15 25 M5 15 L25 15" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ position: 'absolute', top: '80%', right: '3.5%', opacity: accentOpacity }}>
            <svg width="26" height="26" viewBox="0 0 30 30" fill="none" stroke="#1177DE" strokeWidth="2.5">
              <path d="M15 5 L15 25 M5 15 L25 15" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      ) : (
        /* =========================================================
           PATIENT DOODLES: Anchored strictly to outer margins
           ========================================================= */
        <div key="patient-doodles" style={{ position: 'absolute', inset: 0 }}>
          {/* Left Margin - Top: Skin Layers / Epidermis */}
          <div className="doodle-item-float-1" style={{ position: 'absolute', top: '5%', left: '2%', opacity }}>
            <svg width="135" height="125" viewBox="0 0 120 110" fill="none" stroke="#1177DE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 36 C30 32 46 40 64 34 C82 28 96 38 106 32" stroke="#10254C" strokeWidth="3" />
              <path d="M48 35 C46 48 44 64 42 76" stroke="#1177DE" strokeWidth="2.5" />
              <path d="M48 35 L52 14" stroke="#10254C" strokeWidth="2" />
              <path d="M14 56 C32 50 50 62 70 54 C88 48 98 58 106 52" stroke="#448EE2" strokeWidth="1.8" strokeDasharray="4 3" />
              <path d="M14 78 C30 72 52 84 72 76 C90 70 98 80 106 74" stroke="#7CB0EA" strokeWidth="1.8" />
              <path d="M24 18 L26 24 L32 26 L26 28 L24 34 L22 28 L16 26 L22 24 Z" fill="#1177DE" />
              <path d="M84 14 L85 18 L89 19 L85 20 L84 24 L83 20 L79 19 L83 18 Z" fill="#448EE2" />
            </svg>
          </div>

          {/* Left Margin - Mid: Adhesive Bandages & Plasters */}
          <div className="doodle-item-float-3" style={{ position: 'absolute', top: '36%', left: '2.5%', opacity }}>
            <svg width="115" height="115" viewBox="0 0 100 100" fill="none" stroke="#10254C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <g transform="rotate(45 50 50)">
                <rect x="22" y="38" width="56" height="24" rx="10" fill="#ffffff" stroke="#1177DE" strokeWidth="2.2" />
                <rect x="42" y="38" width="16" height="24" fill="rgba(68, 142, 226, 0.2)" stroke="#7CB0EA" strokeWidth="1.2" />
                <circle cx="47" cy="46" r="1" fill="#1177DE" />
                <circle cx="53" cy="46" r="1" fill="#1177DE" />
                <circle cx="47" cy="54" r="1" fill="#1177DE" />
                <circle cx="53" cy="54" r="1" fill="#1177DE" />
              </g>
              <g transform="rotate(-45 50 50)">
                <rect x="22" y="38" width="56" height="24" rx="10" fill="rgba(255,255,255,0.85)" stroke="#10254C" strokeWidth="2.2" />
                <rect x="42" y="38" width="16" height="24" fill="rgba(17, 119, 222, 0.2)" stroke="#7CB0EA" strokeWidth="1.2" />
                <circle cx="47" cy="46" r="1" fill="#10254C" />
                <circle cx="53" cy="46" r="1" fill="#10254C" />
                <circle cx="47" cy="54" r="1" fill="#10254C" />
                <circle cx="53" cy="54" r="1" fill="#10254C" />
              </g>
              <path d="M50 46 C48 42 43 43 43 46 C43 50 50 54 50 54 C50 54 57 50 57 46 C57 43 52 42 50 46 Z" fill="#0000FF" />
            </svg>
          </div>

          {/* Left Margin - Lower-Mid: Aloe Vera Plant */}
          <div className="doodle-item-float-3" style={{ position: 'absolute', top: '65%', left: '2%', opacity: accentOpacity }}>
            <svg width="80" height="85" viewBox="0 0 80 85" fill="none" stroke="#1177DE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M40 74 C36 46 40 24 40 12 C40 24 46 46 40 74 Z" fill="rgba(68, 142, 226, 0.18)" stroke="#10254C" strokeWidth="2.2" />
              <path d="M38 74 C26 54 14 38 10 24 C18 36 30 54 38 74 Z" fill="rgba(17, 119, 222, 0.12)" stroke="#1177DE" />
              <path d="M42 74 C54 54 66 38 70 24 C62 36 50 54 42 74 Z" fill="rgba(17, 119, 222, 0.12)" stroke="#1177DE" />
              <circle cx="40" cy="28" r="2" fill="#0000FF" />
            </svg>
          </div>

          {/* Left Margin - Bottom: Sunscreen SPF 50+ Tube & Sun */}
          <div className="doodle-item-float-2" style={{ position: 'absolute', bottom: '5%', left: '2%', opacity }}>
            <svg width="140" height="140" viewBox="0 0 125 125" fill="none" stroke="#1177DE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="42" cy="38" r="16" fill="rgba(17, 119, 222, 0.15)" stroke="#0000FF" strokeWidth="2.4" />
              <line x1="42" y1="12" x2="42" y2="18" stroke="#0000FF" strokeWidth="2.5" />
              <line x1="42" y1="58" x2="42" y2="64" stroke="#0000FF" strokeWidth="2.5" />
              <line x1="16" y1="38" x2="22" y2="38" stroke="#0000FF" strokeWidth="2.5" />
              <line x1="62" y1="38" x2="68" y2="38" stroke="#0000FF" strokeWidth="2.5" />
              <g transform="rotate(25 78 82)">
                <rect x="66" y="52" width="24" height="46" rx="6" fill="#ffffff" stroke="#10254C" strokeWidth="2.2" />
                <rect x="70" y="98" width="16" height="8" rx="2" fill="#1177DE" stroke="#10254C" strokeWidth="1.8" />
                <text x="70" y="74" fill="#0000FF" fontSize="7" fontWeight="bold" fontFamily="sans-serif">SPF 50+</text>
                <path d="M72 82 C76 80 80 84 84 82" stroke="#448EE2" strokeWidth="1.5" />
              </g>
            </svg>
          </div>

          {/* Right Margin - Top: Hydration Droplet & Waves */}
          <div className="doodle-item-float-1" style={{ position: 'absolute', top: '5%', right: '2%', opacity }}>
            <svg width="130" height="130" viewBox="0 0 110 110" fill="none" stroke="#1177DE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M55 18 C55 18 30 52 30 68 C30 82 41 92 55 92 C69 92 80 82 80 68 C80 52 55 18 55 18 Z" fill="rgba(68, 142, 226, 0.18)" stroke="#0000FF" strokeWidth="2.4" />
              <path d="M42 62 C42 54 48 46 54 42" stroke="#ffffff" strokeWidth="3" />
              <circle cx="41" cy="70" r="2" fill="#ffffff" />
              <ellipse cx="55" cy="98" rx="34" ry="7" stroke="#7CB0EA" strokeWidth="1.8" strokeDasharray="4 3" />
              <ellipse cx="55" cy="104" rx="20" ry="4" stroke="#95BFEE" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Right Margin - Mid: Glowing Face Contour & Aura */}
          <div className="doodle-item-float-2" style={{ position: 'absolute', top: '36%', right: '2.5%', opacity }}>
            <svg width="125" height="125" viewBox="0 0 110 110" fill="none" stroke="#1177DE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M30 40 C30 24 45 16 60 16 C75 16 88 28 88 46 C88 68 76 86 58 92 C46 88 38 78 36 68" stroke="#10254C" strokeWidth="2.4" />
              <path d="M60 48 Q68 54 76 48" stroke="#1177DE" strokeWidth="2.2" fill="none" />
              <line x1="68" y1="52" x2="68" y2="56" stroke="#1177DE" strokeWidth="1.8" />
              <line x1="74" y1="51" x2="76" y2="55" stroke="#1177DE" strokeWidth="1.8" />
              <path d="M62 68 Q70 76 78 68" stroke="#0000FF" strokeWidth="2" fill="none" />
              <path d="M52 58 C50 56 46 58 48 62 C50 64 54 62 52 58" stroke="#448EE2" strokeWidth="1.5" />
              <path d="M18 32 L20 38 L26 40 L20 42 L18 48 L16 42 L10 40 L16 38 Z" fill="#0000FF" />
              <path d="M92 68 L93 72 L97 73 L93 74 L92 78 L91 74 L87 73 L91 72 Z" fill="#1177DE" />
            </svg>
          </div>

          {/* Right Margin - Lower-Mid: Skin Routine Checklist */}
          <div className="doodle-item-float-4" style={{ position: 'absolute', top: '65%', right: '2%', opacity: accentOpacity }}>
            <svg width="85" height="95" viewBox="0 0 90 100" fill="none" stroke="#10254C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="14" y="16" width="64" height="76" rx="5" fill="#ffffff" stroke="#1177DE" strokeWidth="2.2" />
              <path d="M46 12 C44 8 38 9 38 13 C38 18 46 22 46 22 C46 22 54 18 54 13 C54 9 48 8 46 12 Z" fill="#0000FF" stroke="#0000FF" />
              <circle cx="26" cy="38" r="5" stroke="#1177DE" fill="rgba(17,119,222,0.15)" />
              <polyline points="23,38 25,40 29,36" stroke="#1177DE" strokeWidth="1.8" />
              <line x1="36" y1="38" x2="68" y2="38" stroke="#10254C" strokeWidth="1.8" />
              <circle cx="26" cy="56" r="5" stroke="#1177DE" fill="rgba(17,119,222,0.15)" />
              <polyline points="23,56 25,58 29,54" stroke="#1177DE" strokeWidth="1.8" />
              <line x1="36" y1="56" x2="68" y2="56" stroke="#10254C" strokeWidth="1.8" />
            </svg>
          </div>

          {/* Right Margin - Bottom: Moisturizer Cream Tub */}
          <div className="doodle-item-float-4" style={{ position: 'absolute', bottom: '5%', right: '2%', opacity }}>
            <svg width="135" height="135" viewBox="0 0 120 120" fill="none" stroke="#10254C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="24" y="60" width="72" height="42" rx="10" fill="#ffffff" stroke="#1177DE" strokeWidth="2.4" />
              <line x1="24" y1="72" x2="96" y2="72" stroke="#7CB0EA" strokeWidth="1.5" />
              <g transform="rotate(-12 28 50)">
                <rect x="18" y="44" width="76" height="14" rx="4" fill="rgba(17, 119, 222, 0.25)" stroke="#10254C" strokeWidth="2" />
              </g>
              <path d="M46 58 C44 48 56 42 60 46 C64 42 74 48 70 58 Z" fill="rgba(68, 142, 226, 0.25)" stroke="#0000FF" strokeWidth="2" />
              <path d="M88 44 L90 50 L96 52 L90 54 L88 60 L86 54 L80 52 L86 50 Z" fill="#1177DE" />
            </svg>
          </div>

          {/* Ambient Bubbles & Sparkles in Margins */}
          <div style={{ position: 'absolute', top: '22%', left: '3%', opacity: accentOpacity }}>
            <svg width="34" height="34" viewBox="0 0 36 36" fill="none" stroke="#1177DE" strokeWidth="2">
              <circle cx="16" cy="18" r="10" fill="rgba(68, 142, 226, 0.15)" />
              <circle cx="28" cy="12" r="5" fill="rgba(68, 142, 226, 0.2)" />
              <circle cx="26" cy="28" r="4" fill="rgba(68, 142, 226, 0.2)" />
            </svg>
          </div>
          <div style={{ position: 'absolute', top: '80%', left: '3.5%', opacity: accentOpacity }}>
            <svg width="28" height="28" viewBox="0 0 30 30" fill="none" stroke="#0000FF" strokeWidth="2">
              <circle cx="15" cy="15" r="9" fill="rgba(17, 119, 222, 0.12)" />
            </svg>
          </div>
          <div style={{ position: 'absolute', top: '22%', right: '3%', opacity: accentOpacity }}>
            <svg width="30" height="30" viewBox="0 0 36 36" fill="none">
              <path d="M18 4 L21 14 L31 18 L21 22 L18 32 L15 22 L5 18 L15 14 Z" fill="#1177DE" />
            </svg>
          </div>
          <div style={{ position: 'absolute', top: '80%', right: '3.5%', opacity: accentOpacity }}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M16 4 L18 12 L26 16 L18 20 L16 28 L14 20 L6 16 L14 12 Z" fill="#0000FF" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
