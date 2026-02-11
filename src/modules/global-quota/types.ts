export interface GlobalQuotaValues {
  count: number | null;
  size: number | null;
}

export interface UserSpecificQuota {
  user: string;
  storageLimit: number | null;
  countLimit: number | null;
}

export interface QuotaExtraSummary {
  totalExtraStorageLimit: number;
  totalExtraCountLimit: number;
  totalUnlimitedStorage: number;
  totalUnlimitedCount: number;
}
