import { Loaded } from './baseModel';
import { UninitializedRecord } from '@orbit/records';

export interface UserAnalytics extends UninitializedRecord {
  attributes: {
    userId: number;
    year: number;
    month: number;
  };
}

export type UserAnalyticsD = Loaded<UserAnalytics>;

export default UserAnalytics;
