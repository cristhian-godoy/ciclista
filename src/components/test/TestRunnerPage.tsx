import { useMemo, useState } from 'react';

import { DEFAULT_RULES_CONFIG } from '../../core/config/defaults';
import { OSMGraphParser } from '../../core/graph/parser';
import { ROUTING_TEST_CASES } from '../../core/router/test-suite/registry';
import { runRoutingTest, runTestSuite } from '../../core/router/test-suite/runner';
import type { RoutingTestCase, RoutingTestResult } from '../../core/router/test-suite/types';
import type { StrategyRouteVariant } from '../../core/router/types';
import { MapProvider } from '../map/MapContext';
import { MapView } from '../MapView';

/**
 * Visual test suite dashboard component rendering interactive map view and scenario runner.
 */
export default function TestRunnerPage() {
  const [selectedTestId, setSelectedTestId] = useState<string>(ROUTING_TEST_CASES[0]?.id ?? '');
  const [results, setResults] = useState<Record<string, RoutingTestResult>>({});

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
    const res = runRoutingTest(testCase, graph);
    setResults((prev) => ({ ...prev, [testCase.id]: res }));
  };

  const handleRunAll = () => {
    const allResults = runTestSuite(ROUTING_TEST_CASES, graph);
    const resultMap: Record<string, RoutingTestResult> = {};
    for (const res of allResults) {
      resultMap[res.testId] = res;
    }
    setResults(resultMap);
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
    <div className="test-runner-container">
      {/* Sidebar Controls */}
      <div className="test-runner-sidebar">
        <div className="test-runner-header">
          <h1 className="test-runner-title">Routing Test Dashboard</h1>
          <a href="/" className="test-runner-exit-link">
            ← Exit
          </a>
        </div>

        <button type="button" onClick={handleRunAll} className="test-runner-btn-all">
          Run All Tests ({ROUTING_TEST_CASES.length})
        </button>

        <div className="test-runner-cases-list">
          <span className="test-runner-cases-label">Available Test Cases</span>
          {ROUTING_TEST_CASES.map((tc) => {
            const res = results[tc.id];
            const isSelected = tc.id === selectedTestId;
            return (
              <div
                key={tc.id}
                onClick={() => setSelectedTestId(tc.id)}
                className={`test-runner-case-item ${isSelected ? 'selected' : ''}`}
              >
                <div>
                  <div className="test-runner-case-name">{tc.name}</div>
                  <div className="test-runner-case-preset">Preset: {tc.preset}</div>
                </div>
                <div>
                  {res ? (
                    <span
                      className={`test-runner-badge ${
                        res.passed ? 'test-runner-badge--pass' : 'test-runner-badge--fail'
                      }`}
                    >
                      {res.passed ? 'PASS' : 'FAIL'}
                    </span>
                  ) : (
                    <span className="test-runner-badge--idle">IDLE</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedTestCase && (
          <div className="test-runner-detail-card">
            <div className="test-runner-detail-title">{selectedTestCase.name}</div>
            <div className="test-runner-detail-desc">{selectedTestCase.description}</div>
            <button
              type="button"
              onClick={() => handleRunSingle(selectedTestCase)}
              className="test-runner-btn-single"
            >
              Run Selected Test
            </button>

            {selectedResult && (
              <div className="test-runner-result-summary">
                <div className="test-runner-time">
                  Execution Time: {selectedResult.executionTimeMs.toFixed(2)} ms
                </div>
                {selectedResult.failures.length > 0 ? (
                  <div className="test-runner-failures">
                    <strong>Failures:</strong>
                    <ul>
                      {selectedResult.failures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="test-runner-success-msg">All assertions passed cleanly.</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map View */}
      <div className="test-runner-map-view">
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
          theme="dark"
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
          <MapView />
        </MapProvider>
      </div>
    </div>
  );
}
