// API base URL — change this to your production URL when deploying
// For Android emulator, 10.0.2.2 maps to host machine's localhost
// For physical device, use your machine's network IP

import { Platform } from 'react-native';

const DEV_HOST = Platform.select({
  android: '10.158.151.245',  // Android emulator → host localhost
  default: 'localhost',
});
// For physical device, use your machine's network IP (from expo start logs)
export const API_BASE_URL = 'http://10.33.220.163:4000';


export const API_ENDPOINTS = {
  companies: `${API_BASE_URL}/api/companies`,
  companyNews: (id: string) => `${API_BASE_URL}/api/companies/${id}/news`,
  health: `${API_BASE_URL}/api/health`,
};
