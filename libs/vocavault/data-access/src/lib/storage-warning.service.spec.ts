// @vitest-environment jsdom
import { TestBed } from '@angular/core/testing';
import { StorageWarningService } from './storage-warning.service';
import { StorageService } from './storage.service';

describe('StorageWarningService', () => {
  let service: StorageWarningService;
  let storageMock: { getUsagePercent: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    storageMock = { getUsagePercent: vi.fn().mockReturnValue(50) };

    TestBed.configureTestingModule({
      providers: [
        StorageWarningService,
        { provide: StorageService, useValue: storageMock },
      ],
    });
    service = TestBed.inject(StorageWarningService);
  });

  it('returns no warning when usage is below threshold', () => {
    storageMock.getUsagePercent.mockReturnValue(50);
    const result = service.checkAndWarn();
    expect(result.warning).toBe(false);
    expect(result.percent).toBe(50);
  });

  it('returns warning when usage is at 80%', () => {
    storageMock.getUsagePercent.mockReturnValue(80);
    const result = service.checkAndWarn();
    expect(result.warning).toBe(true);
    expect(result.percent).toBe(80);
  });

  it('returns warning when usage exceeds 80%', () => {
    storageMock.getUsagePercent.mockReturnValue(92.3);
    const result = service.checkAndWarn();
    expect(result.warning).toBe(true);
    expect(result.percent).toBe(92);
  });

  it('warns only once per session', () => {
    storageMock.getUsagePercent.mockReturnValue(85);
    const first = service.checkAndWarn();
    expect(first.warning).toBe(true);

    const second = service.checkAndWarn();
    expect(second.warning).toBe(false);
  });

  it('does not warn when below threshold even if called multiple times', () => {
    storageMock.getUsagePercent.mockReturnValue(70);
    expect(service.checkAndWarn().warning).toBe(false);
    expect(service.checkAndWarn().warning).toBe(false);
  });
});
