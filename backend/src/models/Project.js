import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectName: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [120, 'Project name must be at most 120 characters'],
    },
    originalZipFilename: {
      type: String,
      required: true,
      trim: true,
    },
    zipPath: {
      type: String,
      default: null,
    },
    extractedPath: {
      type: String,
      default: null,
    },
    uploadStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    analysisStatus: {
      type: String,
      enum: ['pending', 'queued', 'in_progress', 'completed', 'failed'],
      default: 'pending',
    },
    fileCount: {
      type: Number,
      default: 0,
    },
    extractedSizeBytes: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    structureAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    aiAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    systemArchitecture: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    dataFlowDiagram: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    testCases: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    rating: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    grade: {
      type: String,
      default: null,
    },
    ratingDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Project = mongoose.model('Project', projectSchema);

export default Project;
