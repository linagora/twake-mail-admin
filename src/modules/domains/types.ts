export type GetDomainsResponseType = string[];

export interface DomainQuotaValues {
  count: number | null;
  size: number | null;
}

export interface DomainQuota {
  global: DomainQuotaValues;
  domain: DomainQuotaValues;
  computed: DomainQuotaValues;
}
