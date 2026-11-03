import * as uploadService from '../services/uploadService.js';
import * as analysisService from '../services/analysisService.js';
import { createProjectReport } from '../services/reportService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const uploadProject = asyncHandler(async (req, res) => {
  const project = await uploadService.uploadAndExtractProject({
    userId: req.user._id,
    projectName: req.body.projectName,
    file: req.file,
  });

  res.status(201).json({
    success: true,
    message: 'ZIP uploaded, extracted, and analyzed successfully',
    data: { project },
  });
});

export const listProjects = asyncHandler(async (req, res) => {
  const projects = await uploadService.listUserProjects(req.user._id);

  res.status(200).json({
    success: true,
    data: { projects },
  });
});

export const getProject = asyncHandler(async (req, res) => {
  const project = await uploadService.getUserProjectById(req.user._id, req.params.id);

  res.status(200).json({
    success: true,
    data: { project },
  });
});

export const getProjectAnalysis = asyncHandler(async (req, res) => {
  const result = await analysisService.getStructureAnalysis(req.user._id, req.params.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const downloadProjectReport = asyncHandler(async (req, res) => {
  const result = await analysisService.getStructureAnalysis(req.user._id, req.params.id);
  const pdf = await createProjectReport(result);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${req.params.id}-analysis.pdf"`,
    'Content-Length': pdf.length,
  });
  res.status(200).send(pdf);
});
