import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OverpassService, OsmOverpassError } from './overpass.service';

const BBOX = { south: 6.1, west: 1.1, north: 6.2, east: 1.3 };

function buildTestModule() {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'OVERPASS_API_URL')
        return 'https://overpass.test/interpreter';
      if (key === 'OSM_CACHE_TTL_SECONDS') return 300;
      return undefined;
    }),
  };

  return {
    config,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [
          OverpassService,
          { provide: ConfigService, useValue: config },
        ],
      }).compile();
      return moduleRef.get(OverpassService);
    },
  };
}

describe('OverpassService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns normalized Overpass elements on success', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ elements: [{ type: 'node', id: 1, tags: {} }] }),
    });
    global.fetch = fetchMock;

    const t = buildTestModule();
    const service = await t.build();
    const elements = await service.queryElements(BBOX);

    expect(elements).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches results for the same bbox so a second call does not refetch', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ elements: [] }),
    });
    global.fetch = fetchMock;

    const t = buildTestModule();
    const service = await t.build();
    await service.queryElements(BBOX);
    await service.queryElements(BBOX);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws OsmOverpassError when Overpass responds with a non-ok status', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 504 });
    global.fetch = fetchMock;

    const t = buildTestModule();
    const service = await t.build();
    await expect(service.queryElements(BBOX)).rejects.toThrow(OsmOverpassError);
  });

  it('wraps a network failure (e.g. abort/timeout) as OsmOverpassError', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new Error('The operation was aborted'));
    global.fetch = fetchMock;

    const t = buildTestModule();
    const service = await t.build();
    await expect(service.queryElements(BBOX)).rejects.toThrow(OsmOverpassError);
  });
});
