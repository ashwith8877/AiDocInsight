import api from './api';

export const uploadProjectZip = async ({ projectName, zipFile, onUploadProgress }) => {
  const formData = new FormData();
  formData.append('projectName', projectName);
  formData.append('zipFile', zipFile);

  const { data } = await api.post('/uploads', formData, {
    onUploadProgress,
  });

  return data.data;
};

export const listProjects = async () => {
  const { data } = await api.get('/uploads');
  return data.data.projects;
};

export const getProject = async (id) => {
  const { data } = await api.get(`/uploads/${id}`);
  return data.data.project;
};

export const getProjectAnalysis = async (id) => {
  const { data } = await api.get(`/uploads/${id}/analysis`);
  return data.data;
};

export const downloadProjectReport = (id) =>
  api.get(`/uploads/${id}/report`, { responseType: 'blob' });
