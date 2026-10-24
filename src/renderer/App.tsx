import React, { useState } from 'react';
import { StudioProvider, useStudio } from './state/StudioContext';
import { TopChrome } from './components/TopChrome';
import { ProjectAndAssetsPanel } from './components/ProjectAndAssetsPanel';
import { ViewportPanel } from './components/ViewportPanel';
import { InspectorAndToolsPanel } from './components/InspectorAndToolsPanel';
import { BottomWorkspacePanel } from './components/BottomWorkspacePanel';
import { ModalsAndOverlays } from './components/ModalsAndOverlays';
import { studioRamCache } from '../engine/compositor';

const StudioLayoutInner: React.FC = () => {
  const studio = useStudio();
  const exprErrors = studio.lastFrameResult?.expressionErrors ?? [];
  const [leftW, setLeftW] = useState(282);
  const [rightW, setRightW] = useState(332);
  const [bottomH, setBottomH] = useState(292);
  const spot = studio.activeSpotlightRegion;
  const minimal = studio.activeWorkspace === 'minimal';

  const startResize = (
    axis: 'left' | 'right' | 'bottom',
    startClient: number,
    initialSize: number,
  ) => {
    const onMove = (ev: PointerEvent) => {
      if (axis === 'left') setLeftW(Math.max(210, Math.min(460, initialSize + (ev.clientX - startClient))));
      else if (axis === 'right') setRightW(Math.max(255, Math.min(500, initialSize - (ev.clientX - startClient))));
      else setBottomH(Math.max(170, Math.min(520, initialSize - (ev.clientY - startClient))));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="studio-shell" style={{ cursor: studio.whatsThisMode ? 'help' : undefined }}>
      <div data-tour-active={spot === 'chrome' ? 'true' : undefined}>
        <TopChrome />
      </div>

      {/* Local Crash-Recovery Auto-Restore Banner */}
      {studio.hasRecoverableAutosave && (
        <div
          role="region"
          aria-label="Autosave Recovery Banner"
          style={{
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--accent-cyan)',
            padding: '4px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
          }}
        >
          <span>
            Local Autosave snapshot detected in offline storage — restore previous session?
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="studio-btn primary" style={{ minHeight: 22, padding: '1px 8px', fontSize: 10.5 }} onClick={studio.restoreRecoverableAutosave}>
              Restore Session
            </button>
            <button className="studio-btn ghost" style={{ minHeight: 22, padding: '1px 8px', fontSize: 10.5 }} onClick={studio.dismissRecoverableAutosave}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* What's This? Active Help Banner */}
      {studio.whatsThisMode && (
        <div
          style={{
            background: 'var(--bg-selected)',
            borderBottom: '1px solid var(--accent-amber)',
            padding: '4px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
          }}
        >
          <span>
            <strong>Inspect Help Mode Active:</strong> Click any studio dock (Project, Viewport, Inspector, or Timeline) to inspect its reference card.
          </span>
          <button className="studio-btn" style={{ minHeight: 22, padding: '1px 8px', fontSize: 10.5 }} onClick={() => studio.setWhatsThisMode(false)}>
            Exit (Shift+F1)
          </button>
        </div>
      )}

      {/* Non-Modal Expression Error Banner */}
      {exprErrors.length > 0 && (
        <div
          role="status"
          style={{
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--status-err)',
            padding: '4px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--status-err)',
            fontSize: 11,
          }}
        >
          <span>
            Expression Error on <strong>{exprErrors[0].layerName}</strong>: {exprErrors[0].message}
          </span>
          <span className="mono" style={{ fontSize: 10 }}>Non-blocking fallback active</span>
        </div>
      )}

      {/* Upper 3-Column Studio Dock with Resizable Splitters */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {!minimal && (
          <>
            <div
              data-tour-active={spot === 'left-dock' ? 'true' : undefined}
              style={{ display: 'flex', minHeight: 0 }}
              onClickCapture={(e) => {
                if (studio.whatsThisMode) {
                  e.stopPropagation();
                  studio.setActiveHelpId(studio.leftTab === 'effects' ? 'panel.effects' : 'panel.project');
                }
              }}
            >
              <ProjectAndAssetsPanel widthPx={leftW} />
            </div>
            <div
              className="dock-splitter-v"
              title="Drag to resize Project / Effects Dock"
              onPointerDown={(e) => startResize('left', e.clientX, leftW)}
            />
          </>
        )}

        <div
          data-tour-active={spot === 'viewport' ? 'true' : undefined}
          style={{ flex: 1, display: 'flex', minWidth: 0, minHeight: 0 }}
          onClickCapture={(e) => {
            if (studio.whatsThisMode) {
              e.stopPropagation();
              studio.setActiveHelpId('panel.viewport');
            }
          }}
        >
          <ViewportPanel />
        </div>

        {!minimal && (
          <>
            <div
              className="dock-splitter-v"
              title="Drag to resize Inspector / Scopes Dock"
              onPointerDown={(e) => startResize('right', e.clientX, rightW)}
            />
            <div
              data-tour-active={spot === 'right-dock' ? 'true' : undefined}
              style={{ display: 'flex', minHeight: 0 }}
              onClickCapture={(e) => {
                if (studio.whatsThisMode) {
                  e.stopPropagation();
                  studio.setActiveHelpId('panel.inspector');
                }
              }}
            >
              <InspectorAndToolsPanel widthPx={rightW} />
            </div>
          </>
        )}
      </div>

      {/* Bottom Dock: Timeline / Graph Editor / Node DAG / Render Queue */}
      {!minimal && (
        <>
          <div
            className="dock-splitter-h"
            title="Drag to resize Timeline / Node Graph Dock"
            onPointerDown={(e) => startResize('bottom', e.clientY, bottomH)}
          />
          <div
            data-tour-active={spot === 'bottom-dock' ? 'true' : undefined}
            onClickCapture={(e) => {
              if (studio.whatsThisMode) {
                e.stopPropagation();
                studio.setActiveHelpId('panel.timeline');
              }
            }}
          >
            <BottomWorkspacePanel heightPx={bottomH} />
          </div>
        </>
      )}

      {/* Minimalist Studio Telemetry Status Footer */}
      <footer
        style={{
          height: 24,
          flexShrink: 0,
          padding: '0 12px',
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--status-ok)', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--status-ok)' }} />
            Offline Studio
          </span>
          <span style={{ color: 'var(--border-subtle)' }}>·</span>
          <span style={{ color: 'var(--text-primary)' }}>{studio.statusMessage}</span>
        </div>
        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            {studio.activeComp?.width}×{studio.activeComp?.height} @ {studio.activeComp?.fps}fps
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            RAM: {studioRamCache.getEntryCount()}f ({(studioRamCache.getUsedBytes() / (1024 * 1024)).toFixed(1)} MB)
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {studio.project.bitDepth}-bit · {studio.project.workingColorSpace.toUpperCase()}
          </span>
          <button
            className="studio-btn ghost"
            style={{ minHeight: 18, padding: '0 6px', fontSize: 10.5 }}
            onClick={() => studio.setActiveModal('guide')}
            title="Open Interactive Studio Guide (F1)"
          >
            Guide <span className="kbd-chip" style={{ minHeight: 14, fontSize: 9 }}>F1</span>
          </button>
        </div>
      </footer>

      <ModalsAndOverlays />
    </div>
  );
};

export const App: React.FC = () => (
  <StudioProvider>
    <StudioLayoutInner />
  </StudioProvider>
);
