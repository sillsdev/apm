import { describe, expect, it, beforeEach } from '@jest/globals';
import {
  appendPendingProjectResourceConfig,
  loadPendingProjectResourceConfigs,
  removePendingProjectResourceConfigs,
  takePendingProjectResourceConfigs,
} from './pendingProjectResourceConfig';

describe('pendingProjectResourceConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('queues and drains media ids for configure resume', () => {
    appendPendingProjectResourceConfig('m1');
    appendPendingProjectResourceConfig('m2');
    expect(loadPendingProjectResourceConfigs()).toEqual(['m1', 'm2']);
    expect(takePendingProjectResourceConfigs()).toEqual(['m1', 'm2']);
    expect(loadPendingProjectResourceConfigs()).toEqual([]);
  });

  it('dedupes append and can remove a subset', () => {
    appendPendingProjectResourceConfig('m1');
    appendPendingProjectResourceConfig('m1');
    appendPendingProjectResourceConfig('m2');
    removePendingProjectResourceConfigs(['m1']);
    expect(loadPendingProjectResourceConfigs()).toEqual(['m2']);
  });
});
