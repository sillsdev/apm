import { axiosPost } from '../utils/axios';
export async function logLoginAnalytics(token?: string | null): Promise<void> {
  if (!token) return;
  try {
    await axiosPost('useranalytics/track', undefined, token);
  } catch (error) {
    console.error('logLoginAnalytics', error);
  }
}
