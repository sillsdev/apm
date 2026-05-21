import { axiosPost } from '../utils/axios';
export async function logLoginAnalytics(token?: string | null): Promise<void> {
  axiosPost('useranalytics/track', undefined, token as string)
    //.then((response) => {
    //  console.log(
    //    'logLoginAnalytics',
    //    (response as { data: { data: unknown } }).data?.data
    //  );
    //})
    .catch((error) => {
      console.error('logLoginAnalytics', error);
    });
}
