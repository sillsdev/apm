import { Loaded } from './baseModel';
import { UninitializedRecord } from '@orbit/records';

export interface CountryAnalytics extends UninitializedRecord {
  attributes: {
    country: string;
    year: number;
    month: number;
  };
}

export type CountryAnalyticsD = Loaded<CountryAnalytics>;

export default CountryAnalytics;
