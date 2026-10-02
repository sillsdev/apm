import { InitializedRecord, UninitializedRecord } from '@orbit/records';

export interface UserAnalytics extends UninitializedRecord {
  attributes: {
    userId: number;
    year: number;
    month: number;
  };
}

export type UserAnalyticsD = UserAnalytics & InitializedRecord;

export default UserAnalytics;
