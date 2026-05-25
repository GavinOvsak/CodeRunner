import React, { useState } from 'react';
import { HelpCircle, Check, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface CauseDetail {
  id: string;
  name: string;
  type: 'H' | 'T';
  diagnostics: string;
  treatment: string;
}

const CAUSES: CauseDetail[] = [
  // 5 H's
  {
    id: 'hypovolemia',
    name: 'Hypovolemia',
    type: 'H',
    diagnostics: 'Flat jugular neck veins, collapsed IVC on bedside ultrasound, rapid narrow-complex tachycardia, history of hemorrhage or fluid loss.',
    treatment: 'Establish large-bore IV/IO. Rapid infusion of warm isotonic crystalloids (saline/LR). Administer packed red blood cells if active hemorrhage.'
  },
  {
    id: 'hypoxia',
    name: 'Hypoxia',
    type: 'H',
    diagnostics: 'Cyanosis, low oxygen saturation before arrest, airway obstruction, high airway pressures. Check ET tube positioning/kinking.',
    treatment: 'Administer 100% oxygen. Optimize ventilation (high-flow bag-mask). Secure advanced airway (ET tube or LMA). Confirm placement with waveform capnography.'
  },
  {
    id: 'acidosis',
    name: 'Hydrogen Ion (Acidosis)',
    type: 'H',
    diagnostics: 'History of severe diabetes (DKA), renal failure/dialysis, or prolonged cardiac arrest. Blood gas shows pH < 7.2.',
    treatment: 'Ensure adequate ventilation to blow off carbon dioxide. Consider Sodium Bicarbonate (50 mEq or 1-2 mEq/kg IV/IO) in prolonged arrest or severe pre-existing metabolic acidosis.'
  },
  {
    id: 'potassium',
    name: 'Hypo- / Hyperkalemia',
    type: 'H',
    diagnostics: 'Hyperkalemia: Peaked T waves, wide QRS, history of dialysis or renal failure. Hypokalemia: Flat T waves, prominent U waves, prolonged QT.',
    treatment: 'Hyperkalemia: Calcium Gluconate (1-2g IV) or Calcium Chloride for cardiac stabilization, plus Insulin (10U IV) + Dextrose (D50) and Sodium Bicarb. Hypokalemia: Slow Potassium/Magnesium infusion.'
  },
  {
    id: 'hypothermia',
    name: 'Hypothermia',
    type: 'H',
    diagnostics: 'Exposure history, core body temperature < 30°C (86°F), rigid chest wall, J-waves (Osborn waves) on ECG.',
    treatment: 'Active external rewarming (warm blankets, heating lights). Warm IV fluids. Perform active internal rewarming if core temp is critical.'
  },
  // 5 T's
  {
    id: 'tension',
    name: 'Tension Pneumothorax',
    type: 'T',
    diagnostics: 'Unilateral absent or diminished breath sounds, tracheal deviation, hyper-resonance to percussion, high peak airway pressures on ventilator, distended neck veins.',
    treatment: 'Immediate needle decompression (14G or 16G angiocath in 2nd intercostal space, mid-clavicular line, or 5th intercostal space, anterior axillary line). Follow with chest tube thoracostomy.'
  },
  {
    id: 'tamponade',
    name: 'Tamponade (Cardiac)',
    type: 'T',
    diagnostics: 'Beck\'s Triad: Jugular venous distention, muffled heart sounds, hypotension (if pulse present). Flat-line ECG, ultrasound showing pericardial effusion.',
    treatment: 'Emergency bedside ultrasound-guided pericardiocentesis. Surgical thoracotomy/pericardial window.'
  },
  {
    id: 'toxins',
    name: 'Toxins (Overdose)',
    type: 'T',
    diagnostics: 'History of drug abuse, suicide attempt, pinpoint pupils (opioids), bradycardia, QTc prolongation, specific toxidromes.',
    treatment: 'Administer Naloxone (Narcan) for suspected opioid overdose. Intubate to protect airway. Administer specific antidotes (e.g., Sodium Bicarbonate for TCA overdose, Intralipid for local anesthetics).'
  },
  {
    id: 'pulmonary',
    name: 'Thrombosis (Pulmonary PE)',
    type: 'T',
    diagnostics: 'Sudden onset chest pain/dyspnea before arrest, deep vein thrombosis (DVT) signs, right ventricular strain/dilation on echocardiogram, persistent PEA.',
    treatment: 'Consider empiric thrombolytics (tPA / Alteplase 50mg bolus) during CPR if pulmonary embolism is highly suspected. Surgical embolectomy if post-ROSC.'
  },
  {
    id: 'coronary',
    name: 'Thrombosis (Coronary ACS)',
    type: 'T',
    diagnostics: 'History of CAD, preceding chest pain, ST-elevation myocardial infarction (STEMI) or depression on pre-arrest ECG.',
    treatment: 'Perform emergency coronary angiography (PCI) immediately following ROSC. Consider thrombolytics if catheterization laboratory is unavailable.'
  }
];

export const DiagnosticsCard: React.FC = () => {
  // Store ticked status of H's and T's
  const [ruledOut, setRuledOut] = useState<Record<string, boolean>>({});
  // Store expanded detail states
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleRuleOut = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling accordion when clicking checkbox
    setRuledOut(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="bg-brand-panel border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        <HelpCircle className="w-5 h-5 text-brand-accent animate-pulse" />
        <div>
          <h2 className="text-md font-bold text-white leading-tight">Differential Diagnoses (H's & T's)</h2>
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">ACLS REVERSIBLE CAUSES CHECKS</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 5 H's Column */}
        <div className="space-y-2">
          <span className="text-[10px] text-brand-accent font-black tracking-widest uppercase block mb-1">THE 5 H's</span>
          <div className="space-y-1.5">
            {CAUSES.filter(c => c.type === 'H').map(cause => {
              const isExpanded = expandedId === cause.id;
              const isRuledOut = !!ruledOut[cause.id];
              return (
                <div 
                  key={cause.id}
                  className={`border rounded-xl transition duration-150 overflow-hidden cursor-pointer ${isRuledOut ? 'bg-gray-950/20 border-gray-900 opacity-60' : 'bg-brand-dark/40 border-gray-800 hover:border-gray-700'}`}
                  onClick={() => toggleExpand(cause.id)}
                >
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Interactive check/cross circular button */}
                      <button
                        onClick={(e) => toggleRuleOut(cause.id, e)}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition active:scale-90 ${isRuledOut ? 'bg-brand-success/20 border-brand-success text-brand-success' : 'border-gray-600 hover:border-gray-500 text-transparent'}`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <span className={`text-xs font-bold ${isRuledOut ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                        {cause.name}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-900 bg-brand-panel/20 text-xs space-y-2.5 animate-fadeIn">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block font-bold mb-0.5">Clinical Diagnostics</span>
                        <p className="text-gray-300 leading-relaxed font-medium">{cause.diagnostics}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-brand-accent uppercase block font-bold mb-0.5">Rapid Interventions</span>
                        <p className="text-gray-300 leading-relaxed font-medium">{cause.treatment}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 5 T's Column */}
        <div className="space-y-2">
          <span className="text-[10px] text-brand-danger font-black tracking-widest uppercase block mb-1">THE 5 T's</span>
          <div className="space-y-1.5">
            {CAUSES.filter(c => c.type === 'T').map(cause => {
              const isExpanded = expandedId === cause.id;
              const isRuledOut = !!ruledOut[cause.id];
              return (
                <div 
                  key={cause.id}
                  className={`border rounded-xl transition duration-150 overflow-hidden cursor-pointer ${isRuledOut ? 'bg-gray-950/20 border-gray-900 opacity-60' : 'bg-brand-dark/40 border-gray-800 hover:border-gray-700'}`}
                  onClick={() => toggleExpand(cause.id)}
                >
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => toggleRuleOut(cause.id, e)}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition active:scale-90 ${isRuledOut ? 'bg-brand-success/20 border-brand-success text-brand-success' : 'border-gray-600 hover:border-gray-500 text-transparent'}`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <span className={`text-xs font-bold ${isRuledOut ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                        {cause.name}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-900 bg-brand-panel/20 text-xs space-y-2.5 animate-fadeIn">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block font-bold mb-0.5">Clinical Diagnostics</span>
                        <p className="text-gray-300 leading-relaxed font-medium">{cause.diagnostics}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-brand-danger uppercase block font-bold mb-0.5">Rapid Interventions</span>
                        <p className="text-gray-300 leading-relaxed font-medium">{cause.treatment}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-brand-dark/30 border border-gray-800 rounded-xl p-3 flex gap-2.5 items-start text-[11px] text-gray-400">
        <AlertCircle className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
        <p className="leading-normal font-medium">Consider differential diagnoses early, especially in refractory cardiac arrest or PEA. Tapping checkboxes allows the team to visually check off causes as they are ruled out via history, exam, or bedside ultrasound.</p>
      </div>
    </div>
  );
};
