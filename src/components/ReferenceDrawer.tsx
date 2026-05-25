import React, { useState } from 'react';
import { X, BookOpen, ZoomIn, ZoomOut, Heart, AlertCircle } from 'lucide-react';

interface ReferenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'circular' | 'bls' | 'pediatric' | 'neonatal' | 'lvad' | 'pcac' | 'bradycardia' | 'tachycardia';

export const ReferenceDrawer: React.FC<ReferenceDrawerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('circular');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoomLevel(prev => Math.min(2.5, prev + 0.25));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(0.75, prev - 0.25));
  const handleResetZoom = () => setZoomLevel(1);

  // Guidelines basePath for public routing
  const basePath = '/CodeRunner/';

  const tabs: { id: TabType; name: string }[] = [
    { id: 'circular', name: 'Cardiac Arrest' },
    { id: 'bls', name: 'Adult BLS' },
    { id: 'pcac', name: 'Post-Arrest (PCAC)' },
    { id: 'pediatric', name: 'Pediatric Arrest' },
    { id: 'neonatal', name: 'Neonatal Resus' },
    { id: 'lvad', name: 'LVAD Support' },
    { id: 'bradycardia', name: 'Bradycardia' },
    { id: 'tachycardia', name: 'Tachycardia' },
  ];

  // Render static algorithm images
  const renderImageTab = (imageSrc: string, altText: string) => {
    return (
      <div className="flex flex-col items-center justify-start h-full pb-10">
        {/* Zoom Controls Bar */}
        <div className="flex items-center gap-3 bg-brand-dark/80 border border-gray-800 rounded-xl px-4 py-2 mb-4 sticky top-0 z-10 shrink-0 select-none">
          <button 
            onClick={handleZoomOut} 
            className="p-1 text-gray-400 hover:text-white transition disabled:opacity-40"
            disabled={zoomLevel <= 0.75}
          >
            <ZoomOut className="w-4.5 h-4.5" />
          </button>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider font-mono select-none w-12 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button 
            onClick={handleZoomIn} 
            className="p-1 text-gray-400 hover:text-white transition disabled:opacity-40"
            disabled={zoomLevel >= 2.5}
          >
            <ZoomIn className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={handleResetZoom} 
            className="text-[9px] border border-gray-700 text-gray-450 hover:text-white px-2 py-0.5 rounded transition font-bold uppercase"
          >
            Reset
          </button>
        </div>

        {/* Scrollable image canvas */}
        <div className="w-full flex-grow overflow-auto border border-gray-850 bg-gray-950 rounded-2xl flex items-start justify-center p-2 relative custom-scrollbar">
          <img 
            src={`${basePath}guidelines/${imageSrc}`} 
            alt={altText}
            className="max-w-none transition-transform duration-150 origin-top-center rounded-xl"
            style={{ transform: `scale(${zoomLevel})`, width: '95%' }}
            draggable="false"
          />
        </div>
      </div>
    );
  };

  // Render interactive mobile checklists for algorithms previously stuck inside PDFs
  const renderBradycardiaChecklist = () => {
    return (
      <div className="space-y-4 pr-1 overflow-y-auto h-full pb-10 text-xs custom-scrollbar">
        <div className="bg-brand-warning/10 border border-brand-warning/30 rounded-2xl p-4 space-y-2">
          <h3 className="text-sm font-extrabold text-brand-warning flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-brand-warning animate-pulse" /> Adult Bradycardia Algorithm
          </h3>
          <p className="text-gray-300 font-medium">For heart rates typically &lt; 50/min if symptomatic.</p>
        </div>

        {/* Step 1 */}
        <div className="bg-brand-panel border border-gray-850 rounded-xl p-4 space-y-2">
          <span className="text-[10px] text-brand-accent font-black tracking-widest block uppercase">STEP 1: INITIAL ASSESSMENT</span>
          <ul className="list-disc list-inside text-gray-300 space-y-1 font-medium pl-1">
            <li>Assess appropriateness for clinical condition.</li>
            <li>Maintain patent airway; assist breathing if needed.</li>
            <li>Provide Oxygen if hypoxemic.</li>
            <li>Monitor ECG rhythm, blood pressure, and pulse oximetry.</li>
            <li>Establish IV/IO access.</li>
            <li>Perform 12-lead ECG if available (do not delay therapy).</li>
          </ul>
        </div>

        {/* Step 2 */}
        <div className="bg-brand-panel border border-gray-850 rounded-xl p-4 space-y-2">
          <span className="text-[10px] text-brand-danger font-black tracking-widest block uppercase">STEP 2: IDENTIFY CARDIOVASCULAR INSTABILITY</span>
          <p className="text-gray-200 font-bold">Are any of the following present due to the bradycardia?</p>
          <div className="space-y-1 pl-1 font-medium text-brand-danger">
            <div>• Hypotension?</div>
            <div>• Acutely altered mental status?</div>
            <div>• Signs of shock?</div>
            <div>• Ischemic chest discomfort?</div>
            <div>• Acute heart failure?</div>
          </div>
        </div>

        {/* Treatment branches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-brand-success/5 border border-brand-success/35 rounded-xl p-4 space-y-1">
            <span className="text-[10px] text-brand-success font-black tracking-wider block">IF NO INSTABILITY SYMPTOMS</span>
            <p className="text-gray-300 font-medium">Monitor clinically and observe patient. Consult cardiology.</p>
          </div>
          <div className="bg-brand-danger/5 border border-brand-danger/35 rounded-xl p-4 space-y-2">
            <span className="text-[10px] text-brand-danger font-black tracking-wider block">IF INSTABILITY SYMPTOMS PRESENT</span>
            <div className="space-y-2 text-gray-300 font-medium">
              <div>
                <strong className="text-white block">1. Atropine IV/IO Bolus:</strong>
                First dose: 1 mg. Repeat every 3-5 minutes (max: 3 mg total).
              </div>
              <div className="border-t border-gray-800 pt-1.5">
                <strong className="text-white block">2. Transcutaneous Pacing (TCP):</strong>
                Initiate immediately if Atropine is ineffective or IV access unavailable.
              </div>
              <div className="border-t border-gray-800 pt-1.5">
                <strong className="text-white block">3. Dopamine Infusion:</strong>
                5 to 20 mcg/kg per minute. Titrate to patient response.
              </div>
              <div className="border-t border-gray-800 pt-1.5">
                <strong className="text-white block">4. Epinephrine Infusion:</strong>
                2 to 10 mcg per minute infusion. Titrate.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTachycardiaChecklist = () => {
    return (
      <div className="space-y-4 pr-1 overflow-y-auto h-full pb-10 text-xs custom-scrollbar">
        <div className="bg-brand-danger/10 border border-brand-danger/30 rounded-2xl p-4 space-y-2">
          <h3 className="text-sm font-extrabold text-brand-danger flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-brand-danger animate-pulse" /> Adult Tachycardia Algorithm
          </h3>
          <p className="text-gray-300 font-medium">For heart rates typically &ge; 150/min with pulse.</p>
        </div>

        {/* Step 1 */}
        <div className="bg-brand-panel border border-gray-850 rounded-xl p-4 space-y-2">
          <span className="text-[10px] text-brand-accent font-black tracking-widest block uppercase">STEP 1: INITIAL ASSESSMENT</span>
          <ul className="list-disc list-inside text-gray-300 space-y-1 font-medium pl-1">
            <li>Assess appropriateness for clinical condition.</li>
            <li>Maintain patent airway; support breathing if required.</li>
            <li>Monitor ECG rhythm, blood pressure, and pulse oximetry.</li>
            <li>Establish IV/IO access.</li>
          </ul>
        </div>

        {/* Step 2 */}
        <div className="bg-brand-panel border border-gray-850 rounded-xl p-4 space-y-2">
          <span className="text-[10px] text-brand-danger font-black tracking-widest block uppercase">STEP 2: IDENTIFY CARDIOVASCULAR INSTABILITY</span>
          <p className="text-gray-200 font-bold">Are any of the following present due to the tachycardia?</p>
          <div className="space-y-1 pl-1 font-medium text-brand-danger">
            <div>• Hypotension?</div>
            <div>• Acutely altered mental status?</div>
            <div>• Signs of shock?</div>
            <div>• Ischemic chest discomfort?</div>
            <div>• Acute heart failure?</div>
          </div>
        </div>

        {/* Treatment branches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-brand-danger/5 border border-brand-danger/35 rounded-xl p-4 space-y-2.5">
            <span className="text-[10px] text-brand-danger font-black tracking-wider block uppercase">IF INSTABILITY SYMPTOMS PRESENT</span>
            <div className="space-y-2 text-gray-300 font-medium">
              <div>
                <strong className="text-white block">Synchronized Cardioversion:</strong>
                Initiate immediate cardioversion. Consider sedation before shock.
              </div>
              <div className="border-t border-gray-800 pt-1.5">
                <strong className="text-white block">Narrow Regular (e.g. SVT):</strong>
                Consider Adenosine 6mg rapid IV push (may follow with 12mg).
              </div>
            </div>
          </div>
          <div className="bg-brand-accent/5 border border-brand-accent/35 rounded-xl p-4 space-y-2.5">
            <span className="text-[10px] text-brand-accent font-black tracking-wider block uppercase">IF SYMPTOMS NOT PRESENT (STABLE)</span>
            <div className="space-y-2.5 text-gray-300 font-medium">
              <div>
                <strong className="text-white block font-black">Is QRS Wide? (&ge; 0.12 seconds)</strong>
              </div>
              <div className="border-t border-gray-850 pt-1.5">
                <span className="text-brand-accent block font-bold">• YES (WIDE QRS &ge; 0.12s):</span>
                Consider Adenosine 6mg (only if regular/monomorphic). Consider antiarrhythmic infusions (Amiodarone 150mg over 10 min, Procainamide, or Sotalol).
              </div>
              <div className="border-t border-gray-850 pt-1.5">
                <span className="text-brand-success block font-bold">• NO (NARROW QRS &lt; 0.12s):</span>
                Attempt vagal maneuvers. Administer Adenosine 6mg rapid IV push. Consider Beta-blocker or Calcium channel blocker therapies.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'circular': 
        return renderImageTab('Figure-1-Adult-Cardiac-Arrest-Circular-Algorithm.jpg', 'Adult Cardiac Arrest Circular Algorithm');
      case 'bls': 
        return renderImageTab('Figure-1-Adult-BLS-Algorithm-for-Health-Care-Professionals.jpg', 'Adult Basic Life Support Algorithm');
      case 'pcac': 
        return renderImageTab('pcac-Figure-1-Adult-PCAC-Algorithm.jpg', 'Post-Cardiac Arrest Care Checklist');
      case 'pediatric': 
        return renderImageTab('Figure-2-Pediatric-Cardiac-Arrest-Algorithm-2.jpg', 'Pediatric Cardiac Arrest Algorithm');
      case 'neonatal': 
        return renderImageTab('Figure-2-Neonatal-Resuscitation.jpg', 'Neonatal Resuscitation Algorithm');
      case 'lvad': 
        return renderImageTab('Figure-4-Adult-and-Pediatric-Durable-LVAD-Algorithm.jpg', 'Durable Left Ventricular Assist Device Algorithm');
      case 'bradycardia':
        return renderBradycardiaChecklist();
      case 'tachycardia':
        return renderTachycardiaChecklist();
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fadeIn select-none">
      {/* Backdrop overlay */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
      />

      {/* Slide-over panel container */}
      <div className="relative w-full max-w-lg md:max-w-2xl bg-brand-dark border-l border-gray-850 h-full shadow-2xl flex flex-col z-10 animate-slideLeft">
        {/* Drawer Header */}
        <div className="p-4 border-b border-gray-850 flex items-center justify-between shrink-0 bg-brand-panel">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-accent animate-pulse" />
            <div>
              <h2 className="text-md font-bold text-white leading-tight">Interactive Guidelines Library</h2>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">AHA Resuscitation References</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 bg-brand-panel/60 border-b border-gray-850 shrink-0 select-none scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); handleResetZoom(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition active:scale-95 shrink-0 ${activeTab === tab.id ? 'bg-brand-accent text-white shadow shadow-blue-500/20' : 'bg-brand-dark hover:bg-gray-850 text-gray-400'}`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Active Tab Canvas content */}
        <div className="flex-grow p-4 overflow-hidden relative bg-brand-dark/40">
          {renderActiveTabContent()}
        </div>
      </div>
    </div>
  );
};
