import { Injectable } from '@angular/core';

@Injectable()
export abstract class StorageService {
  abstract get<T>(key: string): T | null;
  abstract set<T>(key: string, value: T): boolean;
  abstract remove(key: string): void;
  abstract clear(): void;
  abstract getUsagePercent(): number;
}
