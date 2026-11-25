import { useLocation } from "react-router";

const REPOSITORY_SEGMENT = /\/repository\/([^/]+)/;

/**
 * The repository path of a repository page, decoded exactly once from the URL. The router decodes
 * a parameter twice, so the link of a repository named "var%2Fmail%2Ferror" (encoded
 * "var%252Fmail%252Ferror") would otherwise open the repository "var/mail/error".
 */
export function useRepositoryId(): string | undefined {
  const { pathname } = useLocation();
  const segment = REPOSITORY_SEGMENT.exec(pathname)?.[1];
  if (segment === undefined) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
