import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  downloadProjectReport,
  getProjectAnalysis,
} from '../services/uploadService';
import Chatbot from '../components/chatbot/Chatbot';

const formatValue = (value) => (value === null || value === undefined || value === '' ? 'Unavailable' : value);

function ItemList({ items, emptyMessage = 'No data available.' }) {
  if (!Array.isArray(items) || !items.length) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item, index) => {
        const value = typeof item === 'string' ? item : item.message || item.title || item.name;
        return (
          <li key={item.code || item.id || `${value}-${index}`} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {item.severity ? <strong className="mr-2 uppercase text-slate-900">{item.severity}</strong> : null}
            {formatValue(value)}
            {item.explanation ? <p className="mt-1">{item.explanation}</p> : null}
            {item.suggestedChange ? <p className="mt-1 text-slate-500">{item.suggestedChange}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Tree({ nodes }) {
  if (nodes && !Array.isArray(nodes)) {
    return <Tree nodes={nodes.children || []} />;
  }

  if (!Array.isArray(nodes) || !nodes.length) {
    return <p className="text-sm text-slate-500">Folder structure unavailable.</p>;
  }

  return (
    <ul className="space-y-1 text-sm text-slate-700">
      {nodes.map((node, index) => (
        <li key={node.path || node.name || index} className="border-l border-slate-200 pl-3">
          {node.name || node.path || formatValue(node)}
          {Array.isArray(node.children) ? <div className="ml-3 mt-1"><Tree nodes={node.children} /></div> : null}
        </li>
      ))}
    </ul>
  );
}

function Diagram({ title, data }) {
  const markerId = `${title.replace(/\s+/g, '-').toLowerCase()}-arrow`;
  const relationships = [
    ...(data?.relationships || []),
    ...(data?.edges || []),
    ...(data?.flows || []),
  ];
  const storedNodes = [...(data?.nodes || []), ...(data?.components || [])];
  const nodeNames = new Map(storedNodes.map((node) => [node.label || node.name || node.id, node]));
  relationships.forEach((relationship) => {
    const source = relationship.source || relationship.from;
    const target = relationship.target || relationship.to;
    if (source && !nodeNames.has(source)) nodeNames.set(source, { id: source, name: source });
    if (target && !nodeNames.has(target)) nodeNames.set(target, { id: target, name: target });
  });
  const nodes = Array.from(nodeNames.values()).slice(0, 18);
  const diagramHeight = Math.max(430, Math.ceil(nodes.length / 3) * 100 + 80);
  const positions = new Map(nodes.map((node, index) => [node.label || node.name || node.id, {
    x: 60 + (index % 3) * 230,
    y: 30 + Math.floor(index / 3) * 100,
  }]));

  if (!nodes.length && !relationships.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm text-slate-500">{title} data is not available for this analysis.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <svg viewBox={`0 0 820 ${diagramHeight}`} role="img" aria-label={`${title} diagram`} className="mt-4 h-auto w-full rounded-lg bg-slate-50">
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill="#0f766e" />
          </marker>
        </defs>
        {relationships.map((relationship, index) => {
          const source = positions.get(relationship.source || relationship.from);
          const target = positions.get(relationship.target || relationship.to);
          if (!source || !target) return null;
          return <line key={relationship.id || index} x1={source.x + 110} y1={source.y + 28} x2={target.x + 110} y2={target.y + 28} stroke="#0f766e" strokeWidth="2" markerEnd={`url(#${markerId})`} />;
        })}
        {nodes.map((node, index) => {
          const name = node.label || node.name || node.id || `Node ${index + 1}`;
          const position = positions.get(name);
          return <g key={name}>
            <rect x={position.x} y={position.y} width="220" height="56" rx="6" fill="#ecfdf5" stroke="#0f766e" />
            <text x={position.x + 110} y={position.y + 25} textAnchor="middle" fontSize="13" fontWeight="600" fill="#172033">{name}</text>
            {node.type ? <text x={position.x + 110} y={position.y + 43} textAnchor="middle" fontSize="10" fill="#526070">{node.type}</text> : null}
          </g>;
        })}
      </svg>
      <p className="mt-3 text-xs text-slate-500">{nodes.length} nodes, {relationships.length} connections from saved analysis data.</p>
    </section>
  );
}

export default function Analysis() {
  const { id } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    let timer;

    const load = async () => {
      try {
        const nextResult = await getProjectAnalysis(id);
        if (!active) return;
        setResult(nextResult);
        setLoading(false);
        if (nextResult.analysisStatus !== 'completed') {
          timer = window.setTimeout(load, 2000);
        }
      } catch (err) {
        if (!active) return;
        if (/project not found/i.test(err.message || '')) {
          setError('Project not found');
          setLoading(false);
          return;
        }
        if (/failed/i.test(err.message || '')) {
          setFailed(true);
          setError(err.message);
          setLoading(false);
          return;
        }
        timer = window.setTimeout(load, 2000);
      }
    };

    load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await downloadProjectReport(id);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${result?.projectName || 'analysis'}-report.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Unable to download report.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading && !result) return <p className="text-sm text-slate-500">Loading analysis...</p>;
  if (error && failed) return <section className="rounded-xl border border-red-200 bg-red-50 p-6"><h1 className="text-xl font-semibold text-red-900">Analysis Failed</h1><p className="mt-2 text-sm text-red-800">{error}</p></section>;
  if (error && !result) return <p className="text-sm text-red-700">Project not found</p>;

  const analysis = result?.analysis || {};
  const rating = result?.rating ?? analysis.rating;
  const grade = result?.grade ?? analysis.grade;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/dashboard" className="text-sm text-teal-700 hover:underline">Back to dashboard</Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{formatValue(result?.projectName)}</h1>
          <p className="mt-1 text-sm text-slate-500">Analysis status: {formatValue(result?.analysisStatus)}</p>
        </div>
        <button type="button" onClick={handleDownload} disabled={downloading} className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60">
          {downloading ? 'Preparing PDF...' : 'Download PDF'}
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['Project Health', rating === undefined ? 'Unavailable' : `${rating} / 100`], ['Grade', formatValue(grade)], ['Issues', Array.isArray(analysis.issues) ? analysis.issues.length : 'Unavailable'], ['Recommendations', Array.isArray(analysis.recommendations) ? analysis.recommendations.length : 'Unavailable']].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></div>)}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Rating factors</h2>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>Base score: {result?.ratingDetails?.baseScore ?? 'Unavailable'}</p>
          <p>Total deductions: {result?.ratingDetails?.deductions ?? 'Unavailable'}</p>
          {Array.isArray(result?.ratingDetails?.factors) && result.ratingDetails.factors.length ? (
            <ul className="space-y-2 pt-2">
              {result.ratingDetails.factors.map((factor) => (
                <li key={factor.code}>
                  {factor.code}: -{factor.deduction} ({factor.severity || 'unspecified'})
                </li>
              ))}
            </ul>
          ) : <p>No rating deductions recorded.</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Project details</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-slate-500">Files</dt><dd className="mt-1 font-medium">{formatValue(result?.fileCount ?? analysis.fileCount)}</dd></div>
          <div><dt className="text-slate-500">Extracted size</dt><dd className="mt-1 font-medium">{result?.extractedSizeBytes ? `${Math.round(result.extractedSizeBytes / 1024)} KB` : 'Unavailable'}</dd></div>
          <div><dt className="text-slate-500">Technologies</dt><dd className="mt-1 font-medium">{Array.isArray(analysis.detectedTechnologies) ? analysis.detectedTechnologies.join(', ') || 'None detected' : 'Unavailable'}</dd></div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Folder structure</h2><div className="mt-4"><Tree nodes={analysis.folderTree || analysis.projectRootStructure} /></div></section>
      <Diagram title="System Architecture" data={result?.systemArchitecture || analysis.systemArchitecture} />
      <Diagram title="Data Flow Diagram" data={result?.dataFlowDiagram || analysis.dataFlowDiagram} />
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Issues</h2><div className="mt-4"><ItemList items={analysis.issues} /></div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">AI recommendations</h2><div className="mt-4"><ItemList items={result?.aiAnalysis?.recommendations || result?.recommendations || analysis.recommendations} /></div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">Test cases</h2><div className="mt-4"><ItemList items={result?.testCases || analysis.testCases} /></div></section>
      <Chatbot projectId={id} />
    </div>
  );
}
