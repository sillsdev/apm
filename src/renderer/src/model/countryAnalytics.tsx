import { InitializedRecord, UninitializedRecord } from '@orbit/records';

export interface CountryAnalytics extends UninitializedRecord {
  attributes: {
    country: string;
    year: number;
    month: number;
  };
}

export type CountryAnalyticsD = CountryAnalytics & InitializedRecord;

export default CountryAnalytics;
