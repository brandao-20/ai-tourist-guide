import axios from 'axios';
import { getApiUrl } from './config.js';

const api = axios.create({
  baseURL: getApiUrl('/api'),
  withCredentials: true,
});

export default api;
