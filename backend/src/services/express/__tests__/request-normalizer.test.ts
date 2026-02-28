import { normalizeModeAndSearchFlags } from '../request-normalizer';

describe('normalizeModeAndSearchFlags', () => {
  it('defaults to chat mode with search disabled when mode is missing', () => {
    const result = normalizeModeAndSearchFlags({});
    expect(result).toEqual({
      mode: 'chat',
      enableSearch: false,
      enableWebSearch: false,
    });
  });

  it('forces search off in chat mode even when flags are true', () => {
    const result = normalizeModeAndSearchFlags({
      mode: 'chat',
      enableSearch: true,
      enableWebSearch: true,
    });
    expect(result).toEqual({
      mode: 'chat',
      enableSearch: false,
      enableWebSearch: false,
    });
  });

  it('enables search defaults in research mode', () => {
    const result = normalizeModeAndSearchFlags({ mode: 'research' });
    expect(result).toEqual({
      mode: 'research',
      enableSearch: true,
      enableWebSearch: true,
    });
  });

  it('disables web search when research mode search is explicitly disabled', () => {
    const result = normalizeModeAndSearchFlags({
      mode: 'research',
      enableSearch: false,
      enableWebSearch: true,
    });
    expect(result).toEqual({
      mode: 'research',
      enableSearch: false,
      enableWebSearch: false,
    });
  });

  it('allows web search override to false in research mode', () => {
    const result = normalizeModeAndSearchFlags({
      mode: 'research',
      enableSearch: true,
      enableWebSearch: false,
    });
    expect(result).toEqual({
      mode: 'research',
      enableSearch: true,
      enableWebSearch: false,
    });
  });
});
