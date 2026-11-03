import fs from 'fs/promises';
import Project from '../models/Project.js';
import ApiError from '../utils/ApiError.js';
import { extractZipSecurely } from '../utils/zipExtractor.js';
import { getExtractDir } from '../utils/paths.js';
import { removeFileQuietly } from '../middleware/uploadMiddleware.js';
import { buildAnalysisArtifacts, runStructureAnalysisForProject } from './analysisService.js';

const sanitizeProject = (project, { includeAnalysis = false } = {}) => {
  const artifacts = project.structureAnalysis ? buildAnalysisArtifacts(project.structureAnalysis) : null;
  const base = {
    id: project._id,
    projectName: project.projectName,
    originalZipFilename: project.originalZipFilename,
    uploadStatus: project.uploadStatus,
    analysisStatus: project.analysisStatus,
    extractedPath: project.extractedPath,
    fileCount: project.fileCount,
    extractedSizeBytes: project.extractedSizeBytes,
    errorMessage: project.errorMessage,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };

  if (includeAnalysis) {
    base.structureAnalysis = project.structureAnalysis || null;
    base.aiAnalysis = project.aiAnalysis || artifacts?.aiAnalysis || null;
    base.systemArchitecture = project.systemArchitecture || artifacts?.systemArchitecture || null;
    base.dataFlowDiagram = project.dataFlowDiagram || artifacts?.dataFlowDiagram || null;
    base.testCases = project.testCases || artifacts?.testCases || null;
    base.rating = project.rating ?? artifacts?.rating ?? null;
    base.grade = project.grade || artifacts?.grade || null;
    base.ratingDetails = project.ratingDetails || artifacts?.ratingDetails || null;
  } else if (project.structureAnalysis) {
    base.projectType = project.structureAnalysis.projectType;
    base.detectedTechnologies = project.structureAnalysis.detectedTechnologies;
    base.issueCount = Array.isArray(project.structureAnalysis.issues)
      ? project.structureAnalysis.issues.length
      : 0;
    base.recommendationCount = Array.isArray(project.structureAnalysis.recommendations)
      ? project.structureAnalysis.recommendations.length
      : 0;
    base.rating = project.rating ?? artifacts?.rating ?? null;
    base.grade = project.grade || artifacts?.grade || null;
  }

  return base;
};

export const uploadAndExtractProject = async ({ userId, projectName, file }) => {
  if (!file) {
    throw ApiError.badRequest('ZIP file is required.');
  }

  const project = await Project.create({
    user: userId,
    projectName: projectName.trim(),
    originalZipFilename: file.originalname,
    zipPath: file.path,
    uploadStatus: 'processing',
    analysisStatus: 'pending',
  });

  const extractRoot = getExtractDir(project._id);

  try {
    const { fileCount, extractedSizeBytes } = await extractZipSecurely(
      file.path,
      extractRoot
    );

    project.extractedPath = extractRoot;
    project.fileCount = fileCount;
    project.extractedSizeBytes = extractedSizeBytes;
    project.uploadStatus = 'completed';
    project.errorMessage = null;
    await project.save();

    await runStructureAnalysisForProject(project);

    return sanitizeProject(project, { includeAnalysis: true });
  } catch (error) {
    const isUploadPhase = project.uploadStatus !== 'completed';

    if (isUploadPhase) {
      await fs.rm(extractRoot, { recursive: true, force: true }).catch(() => {});
      await removeFileQuietly(file.path);
      project.uploadStatus = 'failed';
      project.analysisStatus = 'pending';
      project.zipPath = null;
      project.extractedPath = null;
      project.errorMessage = error.message || 'Upload processing failed.';
      await project.save();
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw ApiError.badRequest(
      isUploadPhase ? 'Failed to process ZIP upload.' : 'Upload succeeded but structure analysis failed.'
    );
  }
};

export const listUserProjects = async (userId) => {
  const projects = await Project.find({ user: userId }).sort({ createdAt: -1 });
  return projects.map((project) => sanitizeProject(project));
};

export const getUserProjectById = async (userId, projectId) => {
  const project = await Project.findOne({ _id: projectId, user: userId });
  if (!project) {
    throw ApiError.notFound('Project not found.');
  }
  return sanitizeProject(project, { includeAnalysis: true });
};
