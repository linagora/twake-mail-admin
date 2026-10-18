import { ProvisionTemplatesValues } from "@/components/custom/provision-templates-form";
import { orPlaceholder, withQuery } from "@/modules/users/details/user-task-commands";

// Previews of the WebAdmin calls run by the domain tasks, shown in their confirmation dialogs.
// Like the user ones, they mirror the query parameters actually sent by the api-client.

export const provisionDomainTemplatesCommand = (domain: string, values: ProvisionTemplatesValues) =>
  `curl -XPOST ${withQuery(`/domains/${domain}/templates`, [
    ["action", "provision"],
    ["from", orPlaceholder(values.sourceUser, "sourceUser")],
    ["folderName", values.folderName.trim()],
    ["overwriteExisting", values.overwriteExisting && "true"],
    ["prune", values.prune && "true"],
    ["usersPerSecond", values.usersPerSecond.trim()],
  ])}`;

export const deleteAllUsersDataCommand = (domain: string) =>
  `curl -XPOST /domains/${domain}?action=deleteData`;
