import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { listProjects } from '../services/uploadService';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listProjects()
      .then((items) => active && setProjects(items))
      .catch((err) => active && setError(err.message || 'Unable to load projects.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-600">Welcome back, {user?.name || 'there'}.</p>
      <div className="mt-6">
        <Link
          to="/upload"
          className="inline-flex rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600"
        >
          Upload ZIP
        </Link>
      </div>
      {error ? <p className="mt-6 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mt-8 text-sm text-slate-500">Loading projects...</p> : null}
      {!loading && !error && !projects.length ? (
        <p className="mt-8 text-sm text-slate-500">No projects uploaded yet.</p>
      ) : null}
      <div className="mt-8 space-y-3">
        {projects.map((project) => {
          const id = project.id || project._id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(`/analysis/${id}`)}
              className="block w-full rounded-lg border border-slate-200 p-4 text-left hover:border-teal-400 hover:bg-teal-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-medium text-slate-900">{project.projectName || 'Untitled project'}</span>
                <span className="text-sm text-slate-500">{project.analysisStatus || 'Unknown'}</span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-5">
                <span>Rating: {project.rating ?? 'Unavailable'}</span>
                <span>Grade: {project.grade || 'Unavailable'}</span>
                <span>Issues: {project.issueCount ?? 'Unavailable'}</span>
                <span>Recommendations: {project.recommendationCount ?? 'Unavailable'}</span>
                <span>{project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'Date unavailable'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
