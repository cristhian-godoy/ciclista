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
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#090d16',
        color: '#e2e8f0',
      }}
    >
      {/* Sidebar Controls */}
      <div
        style={{
          width: '380px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '1rem',
          boxSizing: 'border-box',
          gap: '1rem',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.2rem', margin: 0, color: '#6366f1' }}>
            Routing Test Dashboard
          </h1>
          <a
            href="/"
            style={{
              color: '#94a3b8',
              fontSize: '0.8rem',
              textDecoration: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            ← Exit
          </a>
        </div>

        <button
          type="button"
          onClick={handleRunAll}
          style={{
            padding: '10px',
            backgroundColor: '#6366f1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Run All Tests ({ROUTING_TEST_CASES.length})
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              color: '#94a3b8',
              fontWeight: 600,
            }}
          >
            Available Test Cases
          </span>
          {ROUTING_TEST_CASES.map((tc) => {
            const res = results[tc.id];
            const isSelected = tc.id === selectedTestId;
            return (
              <div
                key={tc.id}
                onClick={() => setSelectedTestId(tc.id)}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  backgroundColor: isSelected
                    ? 'rgba(99, 102, 241, 0.15)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{tc.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Preset: {tc.preset}</div>
                </div>
                <div>
                  {res ? (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: res.passed
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                        color: res.passed ? '#10b981' : '#ef4444',
                        border: res.passed ? '1px solid #10b981' : '1px solid #ef4444',
                      }}
                    >
                      {res.passed ? 'PASS' : 'FAIL'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>IDLE</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedTestCase && (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{selectedTestCase.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {selectedTestCase.description}
            </div>
            <button
              type="button"
              onClick={() => handleRunSingle(selectedTestCase)}
              style={{
                padding: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginTop: '4px',
              }}
            >
              Run Selected Test
            </button>

            {selectedResult && (
              <div
                style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Execution Time: {selectedResult.executionTimeMs.toFixed(2)} ms
                </div>
                {selectedResult.failures.length > 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                    <strong>Failures:</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {selectedResult.failures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                    All assertions passed cleanly.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map View */}
      <div style={{ flex: 1, position: 'relative' }}>
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
