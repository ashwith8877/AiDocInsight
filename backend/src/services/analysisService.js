import Project from '../models/Project.js';
import ApiError from '../utils/ApiError.js';
import { analyzeProjectStructure } from './structureAnalyzer.js';

const severityDeductions = {
  critical: 20,
  high: 12,
  medium: 7,
  low: 3,
};

const gradeForScore = (score) => {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 60) return 'FAIR';
  return 'NEEDS IMPROVEMENT';
};

export const buildAnalysisArtifacts = (analysis) => {
  const issues = Array.isArray(analysis.issues) ? analysis.issues : [];
  const recommendations = Array.isArray(analysis.recommendations)
    ? analysis.recommendations
    : [];
  const deductions = issues.reduce(
    (total, issue) => total + (severityDeductions[issue.severity] || severityDeductions.medium),
    0
  );
  const score = Math.max(0, Math.min(100, 100 - deductions));
  const technologies = analysis.detectedTechnologies || [];
  const rootEntries = analysis.projectRootStructure || [];
  const directories = rootEntries.filter((entry) => entry.type === 'directory');
  const nodes = [
    { id: 'source', name: analysis.projectType || 'Application source', type: 'source' },
    ...directories.slice(0, 12).map((directory) => ({
      id: directory.name,
      name: directory.name,
      type: 'directory',
    })),
    ...technologies.map((technology) => ({
      id: technology,
      name: technology,
      type: 'technology',
    })),
  ];
  const relationships = directories.map((directory) => ({
    source: 'source',
    target: directory.name,
    label: 'contains',
  }));
  const flows = [
    { source: 'User', target: analysis.projectType || 'Application', label: 'request' },
    ...technologies.map((technology) => ({
      source: analysis.projectType || 'Application',
      target: technology,
      label: 'uses',
    })),
  ];
  const testCases = [
    {
      id: 'structure-root',
      name: 'Project root is readable',
      expected: `${rootEntries.length} root entries detected`,
      status: rootEntries.length ? 'passed' : 'failed',
    },
    {
      id: 'technology-detection',
      name: 'Technology detection completed',
      expected: `${technologies.length} technologies detected`,
      status: technologies.length ? 'passed' : 'review',
    },
    {
      id: 'issue-review',
      name: 'Structure findings reviewed',
      expected: `${issues.length} issue(s) reported`,
      status: issues.length ? 'review' : 'passed',
    },
  ];

  return {
    rating: score,
    grade: gradeForScore(score),
    ratingDetails: {
      baseScore: 100,
      deductions,
      issueCount: issues.length,
      factors: issues.map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        deduction: severityDeductions[issue.severity] || severityDeductions.medium,
      })),
    },
    aiAnalysis: {
      source: 'heuristic',
      recommendations: recommendations.map((message, index) => ({
        id: `recommendation-${index + 1}`,
        message,
        explanation: 'This recommendation was derived from the project structure findings.',
        suggestedChange: message,
      })),
    },
    systemArchitecture: { nodes, relationships },
    dataFlowDiagram: { nodes: flows.map((flow) => ({ id: flow.target, name: flow.target })), flows },
    testCases,
  };
};

export const runStructureAnalysisForProject = async (project) => {
  if (!project.extractedPath) {
    throw ApiError.badRequest('Project has no extracted path to analyze.');
  }

  project.analysisStatus = 'in_progress';
  await project.save();

  try {
    const analysis = await analyzeProjectStructure(project.extractedPath);
    const artifacts = buildAnalysisArtifacts(analysis);
    project.structureAnalysis = analysis;
    project.aiAnalysis = artifacts.aiAnalysis;
    project.systemArchitecture = artifacts.systemArchitecture;
    project.dataFlowDiagram = artifacts.dataFlowDiagram;
    project.testCases = artifacts.testCases;
    project.rating = artifacts.rating;
    project.grade = artifacts.grade;
    project.ratingDetails = artifacts.ratingDetails;
    project.analysisStatus = 'completed';
    project.errorMessage = null;
    await project.save();
    return analysis;
  } catch (error) {
    project.analysisStatus = 'failed';
    project.errorMessage = error.message || 'Structure analysis failed.';
    await project.save();
    throw error;
  }
};

export const getStructureAnalysis = async (userId, projectId) => {
  const project = await Project.findOne({ _id: projectId, user: userId }).select(
    'projectName analysisStatus uploadStatus errorMessage fileCount extractedSizeBytes structureAnalysis aiAnalysis systemArchitecture dataFlowDiagram testCases rating grade ratingDetails createdAt updatedAt'
  );

  if (!project) {
    throw ApiError.notFound('Project not found.');
  }

  if (project.uploadStatus !== 'completed') {
    throw ApiError.badRequest('Project upload is not completed yet.');
  }

  if (project.analysisStatus === 'failed') {
    throw ApiError.badRequest(project.errorMessage || 'Structure analysis failed.');
  }

  if (!project.structureAnalysis || project.analysisStatus !== 'completed') {
    throw ApiError.notFound('Structure analysis is not available for this project yet.');
  }

  const artifacts = buildAnalysisArtifacts(project.structureAnalysis);

  return {
    projectId: project._id,
    projectName: project.projectName,
    analysisStatus: project.analysisStatus,
    analysis: project.structureAnalysis,
    fileCount: project.fileCount,
    extractedSizeBytes: project.extractedSizeBytes,
    aiAnalysis: project.aiAnalysis || artifacts.aiAnalysis,
    systemArchitecture: project.systemArchitecture || artifacts.systemArchitecture,
    dataFlowDiagram: project.dataFlowDiagram || artifacts.dataFlowDiagram,
    testCases: project.testCases || artifacts.testCases,
    rating: project.rating ?? artifacts.rating,
    grade: project.grade || artifacts.grade,
    ratingDetails: project.ratingDetails || artifacts.ratingDetails,
    issues: project.structureAnalysis.issues || [],
    recommendations: project.structureAnalysis.recommendations || [],
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
};
