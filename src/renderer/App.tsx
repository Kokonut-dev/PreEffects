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
  const [leftW, setLeftW] = useState(288);
  const [rightW, setRightW] = useState(332);
  const [bottomH, setBottomH] = useState(295);

  const startResize = (
    axis: 'left' | 'right' | 'bottom',
    startClient: number,
    initialSize: number,
  ) => {
    const onMove = (ev: PointerEvent) => {
      if (axis === 'left') setLeftW(Math.max(210, Math.min(440, initialSize + (ev.clientX - startClient))));
      else if (axis === 'right') setRightW(Math.max(250, Math.min(480, initialSize - (ev.clientX - startClient))));
      else setBottomH(Math.max(170, Math.min(500, initialSize - (ev.clientY - startClient))));
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
      <TopChrome />

      {/* Local Crash-Recovery Auto-Restore Banner */}
      {studio.hasRecoverableAutosave && (
        <div
          role="region"
          aria-label="Autosave Recovery Banner"
          style={{
            background: 'rgba(56, 189, 248, 0.14)',
            borderBottom: '1px solid var(--accent-cyan)',
            padding: '4px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
          }}
        >
          <span>
            ● Local Autosave snapshot detected in offline storage — restore previous session?
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="studio-btn primary" style={{ padding: '1px 8px', fontSize: 10.5 }} onClick={studio.restoreRecoverableAutosave}>
              Restore Session
            </button>
            <button className="studio-btn ghost" style={{ padding: '1px 8px', fontSize: 10.5 }} onClick={studio.dismissRecoverableAutosave}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* What's This? Active Help Banner */}
      {studio.whatsThisMode && (
        <div
          style={{
            background: 'rgba(232, 155, 60, 0.18)',
            borderBottom: '1px solid var(--accent-amber)',
            padding: '3px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
          }}
        >
          <span>
            <strong>What&apos;s This? Help Mode Active:</strong> Click any studio dock (Project, Viewport, Inspector, or Timeline) to inspect its reference guide.
          </span>
          <button className="studio-btn" style={{ padding: '1px 7px', fontSize: 10 }} onClick={() => studio.setWhatsThisMode(false)}>
            Exit (Shift+F1)
          </button>
        </div>
      )}

      {/* Non-Modal Expression Error Banner (UX Improvement #4 over AE!) */}
      {exprErrors.length > 0 && (
        <div
          role="status"
          style={{
            background: 'rgba(248, 113, 113, 0.16)',
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
            ⚠ Expression Error on <strong>{exprErrors[0].layerName}</strong>: {exprErrors[0].message}
          </span>
          <span className="mono" style={{ fontSize: 10 }}>Non-blocking fallback active</span>
        </div>
      )}

      {/* Upper 3-Column Studio Dock with Resizable Splitters */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {studio.activeWorkspace !== 'minimal' && (
          <>
            <div
              style={{ display: 'flex' }}
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
          style={{ flex: 1, display: 'flex', minWidth: 0 }}
          onClickCapture={(e) => {
            if (studio.whatsThisMode) {
              e.stopPropagation();
              studio.setActiveHelpId('panel.viewport');
            }
          }}
        >
          <ViewportPanel />
        </div>
        {studio.activeWorkspace !== 'minimal' && (
          <>
            <div
              className="dock-splitter-v"
              title="Drag to resize Inspector / Scopes Dock"
              onPointerDown={(e) => startResize('right', e.clientX, rightW)}
            />
            <div
              style={{ display: 'flex' }}
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

      {/* Horizontal Dock Splitter */}
      <div
        className="dock-splitter-h"
        title="Drag to resize Timeline / Node Graph Dock"
        onPointerDown={(e) => startResize('bottom', e.clientY, bottomH)}
      />

      {/* Bottom Dock: Timeline / Graph Editor / Node DAG / Render Queue */}
      <div
        onClickCapture={(e) => {
          if (studio.whatsThisMode) {
            e.stopPropagation();
            studio.setActiveHelpId('panel.timeline');
          }
        }}
      >
        <BottomWorkspacePanel heightPx={bottomH} />
      </div>

      {/* Bottom Studio Telemetry Status Bar */}
      <footer
        style={{
          height: 22,
          flexShrink: 0,
          padding: '0 10px',
          background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 10.5,
          color: 'var(--text-secondary)',
        }}
      >
        <span>{studio.statusMessage}</span>
        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            Comp: {studio.activeComp?.width}×{studio.activeComp?.height} @ {studio.activeComp?.fps}fps
          </span>
          <span>
            RAM Cache: {studioRamCache.getEntryCount()} frames ({(studioRamCache.getUsedBytes() / (1024 * 1024)).toFixed(1)} MB)
          </span>
          <span>{studio.project.bitDepth}-bit Float · {studio.project.workingColorSpace.toUpperCase()}</span>
          <span style={{ color: 'var(--status-ok)' }}>● Offline Local Storage</span>
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
