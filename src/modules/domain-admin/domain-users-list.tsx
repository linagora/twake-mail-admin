import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { getDomainUsers } from "@/modules/domains/api-client";
import { listUsernames } from "@/modules/users/api-client";
import { PagedUsersList } from "@/modules/users/paged-users-list";
import { UsernamesSource } from "@/modules/users/users-paging";
import { useDomain } from "./domain-context";

/** `GET /domains/{domain}/users` is not paginated: the full domain list is paged client side. */
const listDomainUsernames: UsernamesSource = (request) => getDomainUsers(request.domain);

export default function DomainUsersList() {
  const domain = useDomain();
  const canPageUsersOfDomain = useIsAllowed("GET", "/users?domain={domain}&{params}");

  return (
    <PagedUsersList
      source={canPageUsersOfDomain ? listUsernames : listDomainUsernames}
      domain={domain}
    />
  );
}
