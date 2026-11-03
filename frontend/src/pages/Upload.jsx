import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { uploadProjectZip } from '../services/uploadService';

const MAX_CLIENT_ZIP_BYTES = 50 * 1024 * 1024;

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [projectName, setProjectName] = useState('');
  const [zipFile, setZipFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndSetFile = (file) => {
    setError('');
    setSuccess(null);
    setProgress(0);

    if (!file) {
      setZipFile(null);
      return false;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setZipFile(null);
      setError('Only .zip files are allowed.');
      return false;
    }

    if (file.size > MAX_CLIENT_ZIP_BYTES) {
      setZipFile(null);
      setError('ZIP file must be 50MB or smaller.');
      return false;
    }

    setZipFile(file);
    return true;
  };

  const handleFileChange = (event) => {
    const isValid = validateAndSetFile(event.target.files?.[0] || null);
    if (!isValid) {
      event.target.value = '';
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (!uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (!uploading) {
      validateAndSetFile(event.dataTransfer.files?.[0] || null);
    }
  };

  const handleBrowse = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleUploadAreaKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleBrowse();
    }
  };

  const handleRemoveFile = () => {
    setZipFile(null);
    setError('');
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess(null);

    if (!projectName.trim() || projectName.trim().length < 2) {
      setError('Enter a project name (at least 2 characters).');
      return;
    }

    if (!zipFile) {
      setError('Select a .zip file to upload.');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const response = await uploadProjectZip({
        projectName: projectName.trim(),
        zipFile,
        onUploadProgress: (eventProgress) => {
          if (!eventProgress.total) return;
          const percent = Math.round((eventProgress.loaded * 100) / eventProgress.total);
          setProgress(percent);
        },
      });

      const project = response.project;
      setSuccess(project);
      setProjectName('');
      setZipFile(null);
      setProgress(100);
      event.target.reset?.();
      if (project?.id || project?._id) {
        navigate(`/analysis/${project.id || project._id}`);
      }
    } catch (err) {
      setError(err.message);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Upload project ZIP</h1>
          <p className="mt-2 text-sm text-slate-500">
            Upload a project archive for later analysis. Only authenticated uploads are allowed.
          </p>
        </div>
        <Link to="/dashboard" className="text-sm text-teal-700 hover:underline">
          Back to dashboard
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-3 text-sm text-teal-900">
            <p className="font-medium">Upload successful</p>
            <p className="mt-1">
              {success.projectName} — {success.fileCount} files extracted (
              {Math.round((success.extractedSizeBytes || 0) / 1024)} KB). Analysis status:{' '}
              {success.analysisStatus}.
            </p>
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Project name</span>
          <input
            type="text"
            name="projectName"
            required
            minLength={2}
            maxLength={120}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            disabled={uploading}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
            placeholder="My sample project"
          />
        </label>

        <div className="block text-sm">
          <span className="mb-2 block font-medium text-slate-700">Project ZIP file</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            onChange={handleFileChange}
            disabled={uploading}
            className="sr-only"
          />
          <div
            role="button"
            tabIndex={uploading ? -1 : 0}
            onClick={handleBrowse}
            onKeyDown={handleUploadAreaKeyDown}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            aria-disabled={uploading}
            className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              uploading
                ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
                : isDragging
                  ? 'cursor-copy border-teal-600 bg-teal-50'
                  : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-teal-500 hover:bg-teal-50/60'
            }`}
          >
            <div className="text-4xl" aria-hidden="true">📦</div>
            <p className="mt-3 text-base font-medium text-slate-800">
              {isDragging ? 'Drop your ZIP file here' : 'Drag & drop your ZIP file here'}
            </p>
            <p className="my-2 text-sm text-slate-500">or</p>
            <span className="inline-flex rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white">
              Browse Files
            </span>
            <p className="mt-4 text-xs text-slate-500">ZIP files only · Maximum 50 MB</p>
          </div>
          {zipFile ? (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-xl" aria-hidden="true">📦</span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{zipFile.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(zipFile.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={uploading}
                className="shrink-0 text-sm font-medium text-teal-800 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>

        {uploading ? (
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Uploading and extracting...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={uploading}
          className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
        >
          {uploading ? 'Uploading...' : 'Upload ZIP'}
        </button>
      </form>
    </section>
  );
}
