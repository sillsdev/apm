import {
  asBoolean,
  asString,
  isObject,
  normalizeFields,
  parseJsonObject,
} from './normalData';

describe('isObject', () => {
  test('accepts plain objects only', () => {
    expect(isObject({ a: 1 })).toBe(true);
    expect(isObject({})).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject('x')).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });
});

describe('asString', () => {
  test('keeps strings and drops other types', () => {
    expect(asString('a')).toBe('a');
    expect(asString('')).toBe('');
    expect(asString(1)).toBeUndefined();
    expect(asString(null)).toBeUndefined();
  });
});

describe('asBoolean', () => {
  test('keeps booleans and reads legacy "true" / "false"', () => {
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean(false)).toBe(false);
    expect(asBoolean('true')).toBe(true);
    expect(asBoolean('false')).toBe(false);
  });

  test('drops anything else', () => {
    expect(asBoolean('yes')).toBeUndefined();
    expect(asBoolean(0)).toBeUndefined();
    expect(asBoolean(null)).toBeUndefined();
  });
});

describe('parseJsonObject', () => {
  test('parses a JSON object string', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  test('accepts an object as is', () => {
    const data = { a: 1 };
    expect(parseJsonObject(data)).toBe(data);
  });

  test('reads missing data as empty', () => {
    expect(parseJsonObject(undefined)).toEqual({});
    expect(parseJsonObject(null)).toEqual({});
    expect(parseJsonObject('')).toEqual({});
  });

  test('returns undefined for data that is not a JSON object', () => {
    expect(parseJsonObject('{not json')).toBeUndefined();
    expect(parseJsonObject('null')).toBeUndefined();
    expect(parseJsonObject('[1]')).toBeUndefined();
    expect(parseJsonObject('"text"')).toBeUndefined();
    expect(parseJsonObject(42)).toBeUndefined();
    expect(parseJsonObject([1])).toBeUndefined();
  });
});

describe('normalizeFields', () => {
  test('normalizes known fields and passes others through', () => {
    expect(
      normalizeFields(
        { flag: 'true', name: 'x', extra: 3 },
        {
          flag: asBoolean,
          name: asString,
        }
      )
    ).toEqual({ flag: true, name: 'x', extra: 3 });
  });

  test('drops unusable known fields and reports them', () => {
    const onUnusable = jest.fn();
    expect(
      normalizeFields(
        { flag: 'yes', extra: undefined },
        { flag: asBoolean },
        onUnusable
      )
    ).toEqual({});
    expect(onUnusable).toHaveBeenCalledTimes(1);
    expect(onUnusable).toHaveBeenCalledWith('flag', 'yes');
  });
});
