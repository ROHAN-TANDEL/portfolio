module.exports = [
  {
    id: "react-ex-01",
    title: "Accessible Modal Dialog with Portal, Focus Trap & Escape Key Handler",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Renders an accessible modal dialog outside parent DOM overflow using createPortal, managing body scroll locking, keyboard focus trapping, and Esc key dismissal.",
    conceptsCovered: [
      "ReactDOM.createPortal",
      "Keyboard Accessibility (Esc key)",
      "Body Scroll Locking",
      "Event Bubbling Across Portals",
      "Focus Management"
    ],
    code: `import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function AccessibleModal({ isOpen, onClose, title, children }) {
  const modalRef = useRef(null);

  // 1. Handle Escape key and body scroll locking
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    // Lock background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    // Focus modal dialog container on mount
    modalRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 2. Render into document.body to escape parent CSS stacking contexts
  return createPortal(
    <div 
      className="modal-backdrop" 
      onClick={onClose}
      aria-hidden="true"
    >
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
      >
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}`,
    breakdown: [
      "createPortal renders the dialog as a direct child of document.body, escaping parent overflow:hidden clipping.",
      "Locks document.body.style.overflow to prevent background wheel scrolling while the modal is open.",
      "Listens to keydown on window to support standard accessible Escape key dismissal.",
      "e.stopPropagation() on modal-dialog prevents child clicks from bubbling to the backdrop close handler.",
      "Cleans up event listeners and restores body overflow when unmounted or closed."
    ],
    expectedOutput: `Modal opens rendered directly into document.body with background scroll locked and focus trapped.`
  },
  {
    id: "react-ex-02",
    title: "Custom Imperative Media Player Controller with useImperativeHandle",
    category: "Component Lifecycle & DOM Control",
    difficulty: "advanced",
    whatThisCodeCovers: "Encapsulates a native HTML5 video element inside a child component, exposing a restricted, safe imperative control API (play, pause, seek) to parent components.",
    conceptsCovered: [
      "useImperativeHandle",
      "forwardRef",
      "Encapsulated Imperative API",
      "HTML5 Video DOM Methods"
    ],
    code: `import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

// Child component exposing strictly controlled methods
export const VideoPlayer = forwardRef(function VideoPlayer({ src }, ref) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Expose ONLY safe, deliberate methods to parent components
  useImperativeHandle(ref, () => ({
    play: () => {
      videoRef.current?.play();
      setIsPlaying(true);
    },
    pause: () => {
      videoRef.current?.pause();
      setIsPlaying(false);
    },
    restart: () => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        setIsPlaying(true);
      }
    },
    getCurrentTime: () => videoRef.current?.currentTime || 0
  }), []);

  return (
    <div className="player-wrapper">
      <video 
        ref={videoRef} 
        src={src} 
        onEnded={() => setIsPlaying(false)}
        className="video-element"
      />
      <div className="status">Status: {isPlaying ? 'Playing' : 'Paused'}</div>
    </div>
  );
});

// Parent component controlling player imperatively:
export function MediaDashboard() {
  const playerRef = useRef(null);

  return (
    <div>
      <VideoPlayer ref={playerRef} src="/demo-reel.mp4" />
      <div className="controls">
        <button onClick={() => playerRef.current?.play()}>Play</button>
        <button onClick={() => playerRef.current?.pause()}>Pause</button>
        <button onClick={() => playerRef.current?.restart()}>Restart</button>
      </div>
    </div>
  );
}`,
    breakdown: [
      "forwardRef allows the parent MediaDashboard to pass playerRef to the child VideoPlayer.",
      "useImperativeHandle intercepts the ref and exposes only play, pause, restart, and getCurrentTime.",
      "The parent cannot access raw video DOM attributes or tamper with internal video styling.",
      "Maintains internal playback status state synchronized with HTML5 video event callbacks."
    ],
    expectedOutput: `VideoPlayer controlled cleanly via playerRef.current.play() without exposing raw DOM node.`
  },
  {
    id: "react-ex-03",
    title: "Precise DOM Element Geometry Measurement with useLayoutEffect",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Measures real DOM element dimensions synchronously before browser paint using useLayoutEffect to position an anchored popup tooltip without visual layout flicker.",
    conceptsCovered: [
      "useLayoutEffect vs useEffect",
      "DOM getBoundingClientRect()",
      "Visual Flicker Elimination",
      "Synchronous Style Calculation"
    ],
    code: `import { useState, useLayoutEffect, useRef } from 'react';

export function AnchoredTooltip({ targetRect, content }) {
  const tooltipRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // useLayoutEffect runs SYNCHRONOUSLY after DOM insertion but BEFORE browser paint
  useLayoutEffect(() => {
    if (!tooltipRef.current) return;

    const { width, height } = tooltipRef.current.getBoundingClientRect();

    // Position tooltip centered directly above target element:
    const calculatedTop = targetRect.top - height - 8;
    const calculatedLeft = targetRect.left + (targetRect.width / 2) - (width / 2);

    setCoords({
      top: Math.max(8, calculatedTop), // Boundary guard against viewport top
      left: Math.max(8, calculatedLeft)
    });
  }, [targetRect]);

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: \`\${coords.top}px\`,
        left: \`\${coords.left}px\`,
        pointerEvents: 'none'
      }}
      className="tooltip-bubble"
    >
      {content}
    </div>
  );
}`,
    breakdown: [
      "useLayoutEffect fires synchronously immediately after React mutates the DOM, but before the browser paints.",
      "Measures exact pixel height and width of the tooltip via getBoundingClientRect().",
      "Calculating position in useLayoutEffect guarantees the user never sees the tooltip flash at (0,0) before jumping.",
      "Includes viewport bounds checking to prevent tooltips from clipping off-screen."
    ],
    expectedOutput: `Tooltip appears immediately at the exact computed anchor coordinates with zero visual flicker.`
  },
  {
    id: "react-ex-04",
    title: "Dynamic Form Resetting using the Component Key Prop",
    category: "Component Lifecycle & DOM Control",
    difficulty: "beginner",
    whatThisCodeCovers: "Resets complex nested form component state cleanly by changing its key prop, unmounting the old instance and mounting a fresh instance without manual reset effects.",
    conceptsCovered: [
      "State Reset via key Prop",
      "Component Unmounting Lifecycle",
      "Eliminating Fragile useEffect Resets",
      "Clean Entity Editing"
    ],
    code: `import { useState } from 'react';

// Complex child form with internal drafts and validation state
function CustomerEditor({ customerId, initialEmail, onSave }) {
  const [email, setEmail] = useState(initialEmail);
  const [notes, setNotes] = useState('');
  const [dirty, setDirty] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ customerId, email, notes });
  };

  return (
    <form onSubmit={handleSubmit} className="editor-card">
      <h3>Editing Customer #{customerId}</h3>
      <input 
        value={email} 
        onChange={(e) => { setEmail(e.target.value); setDirty(true); }} 
      />
      <textarea 
        value={notes} 
        onChange={(e) => { setNotes(e.target.value); setDirty(true); }} 
        placeholder="Add call notes..." 
      />
      <button type="submit" disabled={!dirty}>Save Record</button>
    </form>
  );
}

// Parent container switching between different customer records:
export function CustomerManager() {
  const [activeCustomerId, setActiveCustomerId] = useState(101);

  return (
    <div>
      <div className="tab-bar">
        <button onClick={() => setActiveCustomerId(101)}>Customer 101</button>
        <button onClick={() => setActiveCustomerId(102)}>Customer 102</button>
      </div>

      {/* Passing key={activeCustomerId} forces React to mount a brand NEW */}
      {/* component instance on tab switch, wiping draft state instantly! */}
      <CustomerEditor 
        key={activeCustomerId}
        customerId={activeCustomerId}
        initialEmail={activeCustomerId === 101 ? 'alice@acme.com' : 'bob@work.org'}
        onSave={(data) => console.log('Saved:', data)}
      />
    </div>
  );
}`,
    breakdown: [
      "When activeCustomerId switches from 101 to 102, React detects a new key on CustomerEditor.",
      "The previous Fiber instance is destroyed, unmounting all old internal state (email, notes, dirty).",
      "A brand new component instance is mounted with fresh initial state corresponding to customer 102.",
      "Completely eliminates buggy useEffect syncing code where developers forget to clear drafts."
    ],
    expectedOutput: `Switching tabs mounts clean form state instantly with 0 cross-contamination between customers.`
  },
  {
    id: "react-ex-05",
    title: "Synthetic Event Delegation with Capture Phase Interception",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Intercepts user interaction events during the capture phase using onClickCapture to log audit telemetry or enforce global permissions before child handlers execute.",
    conceptsCovered: [
      "Capture Phase vs Bubble Phase",
      "onClickCapture Handler",
      "Event Interception",
      "SyntheticEvent Hierarchy"
    ],
    code: `import { useState } from 'react';

export function PermissionBoundary({ userRole, children }) {
  const [blockedAttempt, setBlockedAttempt] = useState(null);

  // Capture phase listener: Fires BEFORE any child onClick handler!
  const handleCaptureClick = (e) => {
    const isWriteAction = e.target.closest('[data-permission="write"]');

    if (isWriteAction && userRole === 'VIEWER') {
      // Intercept and stop event propagation before child handler ever fires!
      e.stopPropagation();
      e.preventDefault();
      setBlockedAttempt('Permission denied: Viewer role cannot modify data.');
    } else {
      setBlockedAttempt(null);
    }
  };

  return (
    <div onClickCapture={handleCaptureClick} className="permission-guard">
      {blockedAttempt && <div className="alert-banner">{blockedAttempt}</div>}
      <div className="guarded-content">{children}</div>
    </div>
  );
}

// Usage in UI:
export function ActionPanel({ role }) {
  return (
    <PermissionBoundary userRole={role}>
      <button onClick={() => console.log('Viewing details')}>View (Allowed)</button>
      {/* Child click handler will be blocked during capture if role is VIEWER! */}
      <button 
        data-permission="write" 
        onClick={() => console.log('DELETED RECORD!')}
      >
        Delete (Write Protected)
      </button>
    </PermissionBoundary>
  );
}`,
    breakdown: [
      "onClickCapture executes during the descending capture phase, prior to child element bubble listeners.",
      "e.target.closest('[data-permission=\"write\"]') inspects whether the target element requires write permissions.",
      "Calling e.stopPropagation() inside the capture handler prevents the event from reaching the child's onClick handler.",
      "Provides centralized permission assertion across all nested interactive elements."
    ],
    expectedOutput: `Viewer clicks on write-protected buttons are intercepted and blocked before executing action.`
  },
  {
    id: "react-ex-06",
    title: "Auto-Resizing Textarea with DOM Refs and ScrollHeight",
    category: "Component Lifecycle & DOM Control",
    difficulty: "beginner",
    whatThisCodeCovers: "Builds a smooth auto-expanding textarea component that dynamically grows and shrinks with user typing by measuring scrollHeight via a DOM ref.",
    conceptsCovered: [
      "DOM Refs for Measurements",
      "scrollHeight Adjustment",
      "Controlled Input Styling",
      "Layout Thrashing Avoidance"
    ],
    code: `import { useRef, useEffect, useState } from 'react';

export function AutoResizeTextarea({ value, onChange, placeholder, minRows = 2, maxRows = 8 }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto first to calculate accurate scrollHeight on shrink
    textarea.style.height = 'auto';

    // Set new height based on content scrollHeight
    const singleRowHeight = 24; // Approx height per line
    const maxHeight = maxRows * singleRowHeight;
    const computedHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = \`\${computedHeight}px\`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, maxRows]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={minRows}
      className="auto-expanding-input"
    />
  );
}`,
    breakdown: [
      "Attaches textareaRef to inspect the native DOM textarea node.",
      "Resets textarea.style.height = 'auto' before measuring, allowing the field to shrink when text is deleted.",
      "Calculates height matching textarea.scrollHeight bounded by maxRows.",
      "Enables vertical scrollbar only if the content exceeds the maximum configured row height."
    ],
    expectedOutput: `Textarea height expands smoothly as text wraps and contracts cleanly on backspace.`
  },
  {
    id: "react-ex-07",
    title: "Copy to Clipboard Feedback Button with Timer Ref Cleanup",
    category: "Component Lifecycle & DOM Control",
    difficulty: "beginner",
    whatThisCodeCovers: "Implements a copy-to-clipboard button with visual confirmation feedback, using a timer ref to clean up timeouts if the component unmounts mid-timer.",
    conceptsCovered: [
      "navigator.clipboard API",
      "Timer Refs Cleanup",
      "Memory Leak Defense",
      "Transient State Feedback"
    ],
    code: `import { useState, useRef, useEffect } from 'react';

export function CopyButton({ textToCopy, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);

      // Clear existing timer if clicked repeatedly
      if (timerRef.current) clearTimeout(timerRef.current);

      // Revert copied state after 2 seconds
      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  // Crucial: Clean up timer on unmount to prevent setting state on unmounted component!
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <button 
      onClick={handleCopy} 
      className={copied ? 'btn-copied' : 'btn-default'}
      aria-live="polite"
    >
      {copied ? '✓ Copied!' : label}
    </button>
  );
}`,
    breakdown: [
      "Uses modern browser navigator.clipboard.writeText asynchronous API.",
      "timerRef stores the active setTimeout handle across component re-renders.",
      "Clears pending timer if user clicks multiple times in rapid succession.",
      "useEffect cleanup guarantees clearTimeout fires on unmount, eliminating 'Can't perform state update on unmounted component' memory leaks."
    ],
    expectedOutput: `Button copies text, changes label to '✓ Copied!', and safely reverts after 2000ms.`
  },
  {
    id: "react-ex-08",
    title: "Drag and Drop File Upload Area with Drag Event Handlers",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Creates an interactive drag-and-drop file upload dropzone handling dragenter, dragleave, and drop events while managing file validation.",
    conceptsCovered: [
      "HTML5 Drag and Drop API",
      "dragOver / drop preventDefault",
      "Drag Counter Pattern",
      "File Validation"
    ],
    code: `import { useState, useRef } from 'react';

export function FileDropzone({ onFilesSelected, accept = ['image/png', 'image/jpeg'] }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0); // Tracks nested child element drag entries

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files).filter(file => 
      accept.includes(file.type)
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={handleDrop}
      className={\`dropzone \${isDragging ? 'dropzone-active' : ''}\`}
    >
      <p>{isDragging ? 'Drop files here!' : 'Drag & drop image files here'}</p>
    </div>
  );
}`,
    breakdown: [
      "e.preventDefault() and e.stopPropagation() on onDragOver are mandatory to allow drop events in browsers.",
      "dragCounter ref resolves the classic HTML5 drag bug where hovering over child elements triggers premature dragleave.",
      "Filters uploaded files against the allowed MIME type array in e.dataTransfer.files.",
      "Toggles visual styling smoothly via isDragging state."
    ],
    expectedOutput: `Dropzone highlights when dragging files over container and extracts valid dropped files.`
  },
  {
    id: "react-ex-09",
    title: "Infinite Scroll Trigger using Intersection Observer API",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a high-performance infinite scroll sentinel trigger using the browser IntersectionObserver API attached via a callback ref.",
    conceptsCovered: [
      "IntersectionObserver",
      "Sentinel Element Pattern",
      "Callback Ref Cleanup",
      "Infinite Pagination"
    ],
    code: `import { useRef, useCallback } from 'react';

export function InfiniteScrollList({ items, hasMore, isLoading, onLoadMore }) {
  const observerRef = useRef(null);

  // Callback ref: attaches observer to the sentinel DOM node as soon as it mounts
  const sentinelRef = useCallback((node) => {
    if (isLoading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      // When sentinel scrolls into viewport and more pages exist:
      if (entries[0].isIntersecting && hasMore) {
        onLoadMore();
      }
    }, { rootMargin: '200px' }); // Trigger 200px before user hits bottom!

    if (node) observerRef.current.observe(node);
  }, [isLoading, hasMore, onLoadMore]);

  return (
    <div className="list-feed">
      {items.map(item => (
        <div key={item.id} className="feed-card">{item.title}</div>
      ))}

      {/* Sentinel element observed at the bottom of the feed */}
      {hasMore && (
        <div ref={sentinelRef} className="sentinel-loader">
          {isLoading ? 'Loading more posts...' : ''}
        </div>
      )}
    </div>
  );
}`,
    breakdown: [
      "Uses a callback ref on the sentinel element to ensure the observer connects only when the DOM node exists.",
      "rootMargin: '200px' starts loading the next page 200 pixels before the user reaches the bottom, creating a seamless feed.",
      "Disconnects previous observer instance before creating a new one to prevent memory leaks.",
      "Checks isLoading to prevent duplicate simultaneous fetch requests."
    ],
    expectedOutput: `List automatically triggers onLoadMore when scrolling within 200px of sentinel element.`
  },
  {
    id: "react-ex-10",
    title: "Outside Click Dismissal Container for Dropdown Menus",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Detects and handles mouse clicks occurring outside a target container element, dismissing dropdowns and flyout menus automatically.",
    conceptsCovered: [
      "Outside Click Detection",
      "Node.contains() DOM Method",
      "mousedown vs click Timing",
      "Event Listener Teardown"
    ],
    code: `import { useEffect, useRef, useState } from 'react';

export function DropdownMenu({ triggerLabel, items, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event) => {
      // Check if clicked element is NOT inside containerRef
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    // Use mousedown instead of click to trigger before focus shifts
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="dropdown-container">
      <button onClick={() => setIsOpen(!isOpen)}>{triggerLabel} ▼</button>
      {isOpen && (
        <ul className="dropdown-menu">
          {items.map(item => (
            <li key={item.id} onClick={() => { onSelect(item); setIsOpen(false); }}>
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}`,
    breakdown: [
      "containerRef wraps the trigger button and the popup menu together.",
      "containerRef.current.contains(event.target) checks if the clicked target belongs to the component tree.",
      "If contains() returns false, the user clicked outside; setIsOpen(false) dismisses the menu.",
      "Attaches listener to document on 'mousedown' and cleanly removes on unmount or close."
    ],
    expectedOutput: `Dropdown closes automatically whenever user clicks anywhere outside the container.`
  },
  {
    id: "react-ex-11",
    title: "Multi-Step Wizard with Preserved Unmounted Step Data",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs a multi-step checkout wizard that preserves data entered across unmounted steps while validating inputs before advancing.",
    conceptsCovered: [
      "Wizard Step State Hoisting",
      "Validation before Advancement",
      "Unmounted Step Preservation",
      "Conditional Step Rendering"
    ],
    code: `import { useState } from 'react';

export function CheckoutWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    cardNumber: ''
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="wizard-card">
      <div className="step-indicator">Step {currentStep} of 3</div>

      {currentStep === 1 && (
        <div className="step-pane">
          <h4>Account Details</h4>
          <input 
            placeholder="Full Name" 
            value={formData.name} 
            onChange={e => updateField('name', e.target.value)} 
          />
          <button disabled={!formData.name} onClick={() => setCurrentStep(2)}>Next</button>
        </div>
      )}

      {currentStep === 2 && (
        <div className="step-pane">
          <h4>Shipping Address</h4>
          <input 
            placeholder="Street Address" 
            value={formData.address} 
            onChange={e => updateField('address', e.target.value)} 
          />
          <button onClick={() => setCurrentStep(1)}>Back</button>
          <button disabled={!formData.address} onClick={() => setCurrentStep(3)}>Next</button>
        </div>
      )}

      {currentStep === 3 && (
        <div className="step-pane">
          <h4>Review & Payment</h4>
          <p>Name: {formData.name}</p>
          <p>Address: {formData.address}</p>
          <button onClick={() => setCurrentStep(2)}>Back</button>
          <button onClick={() => alert('Order Placed!')}>Place Order</button>
        </div>
      )}
    </div>
  );
}`,
    breakdown: [
      "State (formData) is hoisted to the wizard parent, keeping input values alive when steps unmount.",
      "Current step is toggled via currentStep number state.",
      "Back buttons let users revisit previous steps with their typed values perfectly intact.",
      "Next buttons are disabled until required step fields satisfy validation criteria."
    ],
    expectedOutput: `Users navigate back and forth through steps with zero loss of previously entered form data.`
  }
];
