// The basic view lists more mails per page than the extended one, which fetches the details of each mail
export const BASIC_PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 200;
export const EXTENDED_PAGE_LIMIT = Number(import.meta.env.VITE_PAGE_LIMIT) || 50;

// The extended page holding the first mail of a basic page, so that switching views keeps the mails in sight
export const extendedPageOf = (basicPage: number): number =>
  Math.floor(((basicPage - 1) * BASIC_PAGE_LIMIT) / EXTENDED_PAGE_LIMIT) + 1;
