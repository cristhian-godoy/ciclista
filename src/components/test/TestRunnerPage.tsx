import { useMemo, useState } from 'react';

import { DEFAULT_RULES_CONFIG } from '../../core/config/defaults';
import { OSMGraphParser } from '../../core/graph/parser';
import { ROUTING_TEST_CASES } from '../../core/router/test-suite/registry';
import { runRoutingTest, runTestSuite } from '../../core/router/test-suite/runner';
import type { RoutingTestCase, RoutingTestResult } from '../../core/router/test-suite/types';
import type { StrategyRouteVariant } from '../../core/router/types';
import { GlobalControlsPanel } from '../GlobalControlsPanel';
import { MapProvider } from '../map/MapContext';
import { MapView } from '../MapView';

/**
 * Visual test suite dashboard component rendering interactive map view and scenario runner.
 */
export default function TestRunnerPage() {
  const [selectedTestId, setSelectedTestId] = useState<string>(ROUTING_TEST_CASES[0]?.id ?? '');
  const [results, setResults] = useState<Record<string, RoutingTestResult>>({});
  const [theme, setTheme] = useState<'bright' | 'liberty' | 'dark'>('dark');

  // Parse baseline graph fixture once
  const graph = useMemo(() => {
    const parser = new OSMGraphParser();
    return parser.parse(null);
  }, []);

  const selectedTestCase = useMemo(
    () => ROUTING_TEST_CASES.find((tc) => tc.id === selectedTestId) ?? ROUTING_TEST_CASES[0],
    [selectedTestId],
  );

  const selectedResult = useMemo(
    () => (selectedTestCase ? results[selectedTestCase.id] : null),
    [results, selectedTestCase],
  );

  const handleRunSingle = (testCase: RoutingTestCase) => {
    // Non-blocking asynchronous dispatch to prevent freezing the UI thread
    setTimeout(() => {
      const res = runRoutingTest(testCase, graph);
      setResults((prev) => ({ ...prev, [testCase.id]: res }));
    }, 0);
  };

  const handleRunAll = () => {
    // Non-blocking asynchronous dispatch to prevent freezing the UI thread
    setTimeout(() => {
      const allResults = runTestSuite(ROUTING_TEST_CASES, graph);
      const resultMap: Record<string, RoutingTestResult> = {};
      for (const res of allResults) {
        resultMap[res.testId] = res;
      }
      setResults(resultMap);
    }, 0);
  };

  const activeAlternativeLabel: 'standard' | 'avoid-stops' | 'quiet-streets' = useMemo(() => {
    const strat = selectedTestCase?.strategy;
    if (strat === 'stop_avoidance') return 'avoid-stops';
    if (strat === 'quiet_streets') return 'quiet-streets';
    return 'standard';
  }, [selectedTestCase]);

  // Convert resolved route into StrategyRouteVariant array for MapProvider
  const routeVariants: StrategyRouteVariant[] = useMemo(() => {
    if (!selectedResult?.resolvedRoute || !selectedTestCase) return [];
    return [
      {
        strategyKey: activeAlternativeLabel,
        label: activeAlternativeLabel,
        result: selectedResult.resolvedRoute,
        isSecondary: false,
      },
    ];
  }, [selectedResult, selectedTestCase, activeAlternativeLabel]);

  return (
    <div className="ciclista-workbench">
      {/* Workbench Sidebar Controls */}
      <div className="ciclista-workbench-sidebar ciclista-glass-panel">
        <div className="ciclista-workbench-header">
          <h1 className="ciclista-workbench-title">Routing Test Dashboard</h1>
          <a href="/" className="ciclista-workbench-exit">
            ← Exit
          </a>
        </div>

        <button type="button" onClick={handleRunAll} className="ciclista-btn ciclista-btn--primary">
          Run All Tests ({ROUTING_TEST_CASES.length})
        </button>

        <div className="ciclista-cases-list">
          <span className="ciclista-label">Available Test Cases</span>
          {ROUTING_TEST_CASES.map((tc) => {
            const res = results[tc.id];
            const isSelected = tc.id === selectedTestId;
            return (
              <div
                key={tc.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedTestId(tc.id);
                  }
                }}
                onClick={() => setSelectedTestId(tc.id)}
                className={`ciclista-case-item ${isSelected ? 'selected' : ''}`}
              >
                <div>
                  <div className="ciclista-case-name">{tc.name}</div>
                  <div className="ciclista-case-preset">Preset: {tc.preset}</div>
                </div>
                <div>
                  {res ? (
                    <span
                      className={`ciclista-badge ${
                        res.passed ? 'ciclista-badge--pass' : 'ciclista-badge--fail'
                      }`}
                    >
                      {res.passed ? 'PASS' : 'FAIL'}
                    </span>
                  ) : (
                    <span className="ciclista-badge--idle">IDLE</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedTestCase && (
          <div className="ciclista-card">
            <div className="ciclista-detail-title">{selectedTestCase.name}</div>
            <div className="ciclista-detail-desc">{selectedTestCase.description}</div>
            <button
              type="button"
              onClick={() => handleRunSingle(selectedTestCase)}
              className="ciclista-btn ciclista-btn--secondary"
            >
              Run Selected Test
            </button>

            {selectedResult && (
              <div className="ciclista-result-summary">
                <div className="ciclista-time-label">
                  Execution Time: {selectedResult.executionTimeMs.toFixed(2)} ms
                </div>
                {selectedResult.failures.length > 0 ? (
                  <div className="ciclista-failures">
                    <strong>Failures:</strong>
                    <ul>
                      {selectedResult.failures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="ciclista-success-msg">All assertions passed cleanly.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map View */}
      <div className="ciclista-map-view-wrapper">
        <MapProvider
          graph={graph}
          loadedBBoxes={[]}
          startCoord={selectedTestCase?.startCoord ?? null}
          endCoord={selectedTestCase?.endCoord ?? null}
          routeVariants={routeVariants}
          activeAlternativeLabel={activeAlternativeLabel}
          onSelectAlternative={() => {}}
          selectedPreset={selectedTestCase?.preset ?? 'munich'}
          customNodeDelays={new Map()}
          customNodeNotes={new Map()}
          customNodeTurns={new Map()}
          rulesConfig={DEFAULT_RULES_CONFIG}
          bikeConfig={{ id: 'normal' }}
          selectedNode={null}
          onStartDrag={() => {}}
          onEndDrag={() => {}}
          onNodeSelect={() => {}}
          onSaveNodeOverride={() => {}}
          onSaveNodeTurns={() => {}}
          onClearNodeOverride={() => {}}
          theme={theme}
          isInspectorModeActive={false}
          onToggleInspectorMode={() => {}}
          selectedNodeId={null}
          setSelectedNodeId={() => {}}
          selectedAlternativeTargetId={null}
          setSelectedAlternativeTargetId={() => {}}
          navigationState={{
            status: 'idle',
            cameraMode: 'north-up',
            snapped: null,
            raw: null,
            progress: null,
            routeCoordinates: [],
            startTimestamp: null,
          }}
          isNavigating={false}
          rideStats={null}
          onStopNavigation={() => {}}
        >
          <MapView tileless={true} />
          <GlobalControlsPanel theme={theme} onThemeChange={setTheme} />
        </MapProvider>
      </div>
    </div>
  );
}
