import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiGet, apiPost } from '../api/client';

interface TestCase {
  id: string;
  number: number;
  name: string;
  description: string;
  attack_vector: string;
  expected_result: string;
  expected_status: number;
  expected_event?: string;
}

interface TestRunResult {
  test_id: string;
  name: string;
  attack_vector: string;
  expected_status: number;
  expected_result: string;
  actual_status: number;
  actual_result: string;
  passed: boolean;
  details: string;
  assertions: string[];
  latency_ms: number;
  timestamp: string;
}

export const SecurityTestsPage: React.FC = () => {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestRunResult>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<TestCase[]>('/security-tests/cases')
      .then((data) => setTestCases(data || []))
      .catch((err) => {
        setError(err?.detail || err?.message || 'Failed to fetch security test catalog.');
      })
      .finally(() => setLoadingCases(false));
  }, []);

  const handleRunTest = async (testId: string) => {
    setRunningTestId(testId);
    try {
      const res = await apiPost<TestRunResult>('/security-tests/run', { test_id: testId });
      setTestResults((prev) => ({
        ...prev,
        [testId]: res,
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [testId]: {
          test_id: testId,
          name: testCases.find((t) => t.id === testId)?.name || testId,
          attack_vector: 'Backend Request Failure',
          expected_status: 200,
          expected_result: 'REJECTED',
          actual_status: err?.status || 500,
          actual_result: 'ERROR',
          passed: false,
          details: err?.detail || err?.message || 'Security test execution request failed.',
          assertions: ['HTTP request aborted or rejected by gateway.'],
          latency_ms: 0,
          timestamp: new Date().toISOString(),
        },
      }));
    } finally {
      setRunningTestId(null);
    }
  };

  const handleRunAll = async () => {
    for (const test of testCases) {
      await handleRunTest(test.id);
    }
  };

  const toggleExpand = (testId: string) => {
    setExpandedDetails((prev) => ({ ...prev, [testId]: !prev[testId] }));
  };

  const passedCount = Object.values(testResults).filter((r) => r.passed).length;
  const executedCount = Object.keys(testResults).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            <span>Security Test Center</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Execute real automated attacks against the backend cryptographic engine to mathematically verify threshold security, AEAD tags, replay prevention, and tenant isolation.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {executedCount > 0 && (
            <span className="text-xs font-mono px-3 py-1.5 rounded-lg bg-vault-900 border border-vault-700 text-slate-300">
              <strong className="text-emerald-400">{passedCount}</strong> / {executedCount} Verified Passed
            </span>
          )}
          <button
            onClick={handleRunAll}
            disabled={runningTestId !== null || testCases.length === 0}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-2 shadow-glow-danger transition-all self-start sm:self-auto"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{runningTestId ? 'Executing Suite...' : 'Execute All Tests'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loadingCases ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-vault-900 rounded-xl border border-vault-800"></div>
          ))}
        </div>
      ) : (
        /* Test Scenarios Grid */
        <div className="space-y-3">
          {testCases.map((test) => {
            const res = testResults[test.id];
            const isRunning = runningTestId === test.id;
            const isExpanded = !!expandedDetails[test.id];

            return (
              <div
                key={test.id}
                className="glass-panel p-4 rounded-xl border border-vault-700/80 hover:border-vault-600 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-vault-800 text-blue-400 border border-vault-700 flex items-center justify-center font-mono text-xs font-bold shrink-0">
                      T{test.number}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-slate-100 text-xs">{test.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-vault-800 text-slate-400 border border-vault-700">
                          {test.attack_vector}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{test.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    <div className="text-right text-xs font-mono">
                      <span className="text-slate-500">Expected: </span>
                      <span
                        className={`font-bold ${
                          test.expected_result === 'SUCCESS' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {test.expected_result}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRunTest(test.id)}
                      disabled={isRunning}
                      className="px-3 py-1.5 rounded-lg bg-vault-800 hover:bg-vault-700 text-slate-200 border border-vault-700 text-xs font-mono flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                    >
                      {isRunning ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 text-blue-400" />
                          <span>Run Test</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Real Execution Results Drawer */}
                {res && (
                  <div
                    className={`p-3.5 rounded-lg border text-xs font-mono space-y-2 animate-in fade-in ${
                      res.passed
                        ? 'bg-vault-950 border-emerald-500/40 text-slate-300'
                        : 'bg-vault-950 border-red-500/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {res.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <span className={res.passed ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                          {res.passed ? 'VERIFIED PASSED' : 'SECURITY CHECK FAILED'}:
                        </span>
                        <span className="text-slate-200">{res.details}</span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 ml-2">
                        <span className="text-[11px] text-slate-500">
                          {res.latency_ms} ms • HTTP {res.actual_status}
                        </span>
                        {res.assertions && res.assertions.length > 0 && (
                          <button
                            onClick={() => toggleExpand(test.id)}
                            className="text-blue-400 hover:text-blue-300 text-[10px] flex items-center space-x-0.5"
                          >
                            <span>Assertions ({res.assertions.length})</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Detailed Assertions Trace */}
                    {isExpanded && res.assertions && (
                      <div className="pt-2 border-t border-vault-800 text-[11px] font-mono text-slate-400 space-y-1">
                        <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                          Cryptographic Assertion Trace:
                        </div>
                        {res.assertions.map((assertion, idx) => (
                          <div key={idx} className="flex items-center space-x-1.5 pl-2">
                            <span className="text-blue-400">›</span>
                            <span>{assertion}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
