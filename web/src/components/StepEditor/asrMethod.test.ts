import { createElement } from 'react';
import { render } from '@testing-library/react';
import {
  asrMethodFromSettings,
  useAsrMethod,
  withAsrMethod,
} from './useAsrMethod';

function Probe(props: {
  toolSettings: string;
  seen: Array<string | undefined>;
}) {
  const { chosenMethod } = useAsrMethod(props.toolSettings);
  props.seen.push(chosenMethod);
  return null;
}

describe('asrMethodFromSettings', () => {
  it('reads a chosen method', () => {
    expect(asrMethodFromSettings({ asrMethod: 'mms' })).toBe('mms');
  });

  it('treats a missing, empty, or default method as unset', () => {
    expect(asrMethodFromSettings({})).toBeUndefined();
    expect(asrMethodFromSettings({ asrMethod: '' })).toBeUndefined();
    expect(asrMethodFromSettings({ asrMethod: 'default' })).toBeUndefined();
    expect(asrMethodFromSettings({ asrMethod: 1 })).toBeUndefined();
  });
});

describe('withAsrMethod', () => {
  it('stores a chosen method without changing the original settings', () => {
    const settings = { phonetic: false };
    expect(withAsrMethod(settings, 'mms')).toEqual({
      phonetic: false,
      asrMethod: 'mms',
    });
    expect(settings).toEqual({ phonetic: false });
  });

  it('drops the method when the choice returns to the default', () => {
    expect(
      withAsrMethod({ asrMethod: 'mms', phonetic: false }, undefined)
    ).toEqual({ phonetic: false });
  });
});

describe('useAsrMethod', () => {
  it('reads the method from toolSettings on the render that receives it', () => {
    const seen: Array<string | undefined> = [];
    const view = render(
      createElement(Probe, { toolSettings: '{"asrMethod":"mms"}', seen })
    );
    expect(seen[0]).toBe('mms');

    const next = seen.length;
    view.rerender(
      createElement(Probe, { toolSettings: '{"asrMethod":"whisper"}', seen })
    );
    expect(seen[next]).toBe('whisper');
  });
});
