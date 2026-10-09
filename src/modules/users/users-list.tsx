import { useFetchData } from "@/hooks/use-fetch-data";
import { useIsAllowed } from "@/lib/proxy-resolver-context";
import { getDomains } from "@/modules/domains/api-client";
import { listUsernames } from "./api-client";
import { PagedUsersList } from "./paged-users-list";

export default function UsersList() {
  const canListDomains = useIsAllowed("GET", "/domains");
  const { data: domains } = useFetchData<string[]>(canListDomains ? getDomains : null);

  return <PagedUsersList source={listUsernames} domainChoices={domains ?? []} />;
}
