import api from './api';

export const sendChatMessage = async (projectId, message) => {
  const { data } = await api.post('/chat', { projectId, message });
  return data.data?.response || data.message;
};
