# Coverage

Every case of both test plans, and the test automating it. Test classes are under
`src/test/java/com/linagora/admin/e2e/{mail,calendar}/<area>/`; their `@DisplayName` starts with
the case identifier. A note in brackets says what part of a case is not asserted, and why: in
most cases the backend version under test does not offer the route, or the data cannot be produced
without disturbing other tests.

**Mail: 97 / 97 cases. Calendar: 90 / 90 cases.**

## Known bugs

Tests tagged `known-bug` assert the correct behaviour and fail today; they are excluded by
default (`-De2e.excludedGroups=` runs them).

| Test | Bug |
|---|---|
| `mail.shell.ResponsiveTest.networkChannelsWithSessionsFitPhone` | Network Channels: with sessions, the channel grid is ~540 px wide on a 390 px phone |
| `mail.shell.KeyboardTest.contactDismissedWhileLoadingStaysClosed` | Domain contact dialog closed with Escape while loading reopens when the data arrives |
| `mail.shell.HealthCheckTest.healthCheckStatusIsNotColourOnly` | Health check status is conveyed by colour only |
| `mail.domains.TeamMailboxFolderTest.extraAclForAnotherDomainIsRefusedWithAReason` | Backend answers 500 on a team mailbox extra ACL for a user of another domain |

Not tagged, backend side: the Event Dead Letter search shows `Group: N/A / Insertion ID: N/A`,
WebAdmin sends `X-Group` / `X-Insertion-Id` without `Access-Control-Expose-Headers`, so a cross
origin app cannot read them
([linagora/james-project#5623](https://github.com/linagora/james-project/issues/5623)).

## Twake Mail Admin

### Mail — Navigation, health check, mailing lists, network channels, Cassandra, resource locator, JMAP report, live metrics

| Case | Test |
|---|---|
| NAV-01 | NavigationTest.sidebarLandingPage |
| NAV-02 | LanguageTest.languageSelector (Explore User Quota "Max:" and the task detail dialog in French not checked) |
| NAV-03 | NavigationTest.directUrlNavigation |
| NAV-04 | NavigationTest.mobileMenuButton |
| NAV-05 | IconButtonsTest.taskPageIconButtons, pagesIconButtons; DegradedStateTest.deadLetterIconButtons |
| NAV-06 | ResponsiveTest.listPagesFitPhone, otherListPagesFitPhone, detailPagesFitPhone; known-bug networkChannelsWithSessionsFitPhone (channel grid ~540 px wide at 390 px) |
| NAV-07 | ErrorToastsTest.errorToastsShowWebAdminMessage |
| NAV-08 | ResponsiveTest.deleteIdentityDialogWrapsLongWords, DegradedStateTest.deleteEventDialogWrapsLongWords |
| NAV-09 | KeyboardTest.openDetailsFromKeyboard (step 3, repository mail / channel username: no such data); known-bug contactDismissedWhileLoadingStaysClosed (contact dialog reopens after Escape while loading) |
| NAV-10 | KeyboardTest.toastsAccessibleOverDialog |
| HC-01 | HealthCheckTest.healthCheckSections; known-bug healthCheckStatusIsNotColourOnly |
| HC-02 | DegradedStateTest.unhealthyComponentTooltip (degraded answer stubbed in the test's browser: real dead letters land after 30 s to 5+ min) |
| ML-01 | MailingListsTest.mailingListsWithoutLdap |
| NC-01 | NetworkChannelsTest.networkChannelsPage (list stubbed empty, "Disconnect all" intercepted so it cannot cut other tests' sessions; geolocation: no Internet) |
| CAS-01 | CassandraTest.schemaVersions |
| RL-01 | ResourceLocatorTest.lookUpMailbox |
| RL-02 | ResourceLocatorTest.locateMessage |
| JMAP-01 | JmapSettingsReportTest.emptyReport (stubbed), reportCountsSavedSettings |
| LM-01 | LiveMetricsTest.liveMetricsPage |

### Mail — Domains & Team mailboxes

| Case | Test |
|---|---|
| DOM-01 | DomainsListTest.createDomain |
| DOM-02 | DomainsListTest.deleteDomain |
| DOM-03 | DomainsListTest.createDomainErrors |
| DOM-04 | DomainsListTest.searchAndPaginate |
| DOM-05 | DomainImportTest.importDomains |
| DOM-06 | DomainSectionsTest.detailPageStructure |
| DOM-07 | DomainQuotaTest.updateAndResetSizeLimit |
| DOM-08 | DomainQuotaTest.resourceUsageAndQuotaExplorer |
| DOM-09 | DomainSectionsTest.addAndRemoveAlias |
| DOM-10 | DomainSectionsTest.domainContacts |
| DOM-11 | DomainSignatureTemplatesTest.signatureTemplates (editor + error toasts: no signature-templates routes on tmail-backend 1.0.22) |
| DOM-12 | DomainRateLimitsTest.domainRateLimits |
| DOM-13 | DomainSectionsTest.jmapSettingsReport |
| DOM-14 | DomainTasksTest.applySignaturesAndProvisionTemplates, DomainTasksTest.deleteAllUsersData |
| DOM-15 | DomainRateLimitsTest.domainRateLimitsRejectInvalidValues, userRateLimitsRejectInvalidValues |
| DOM-16 | DomainsListTest.enterOpensConfirmation |
| DTM-01 | TeamMailboxesTest.createOpenDeleteTeamMailbox |
| DTM-02 | TeamMailboxesTest.teamMailboxMembers |
| DTM-03 | TeamMailboxesTest.teamMailboxFolders |
| DTM-04 | TeamMailboxFolderTest.subaddressing, extraAcl; known-bug extraAclForAnotherDomainIsRefusedWithAReason (backend 500 on extraAcl for a user of another domain) |
| DTM-05 | TeamMailboxSettingsTest.teamMailboxQuota |
| DTM-06 | TeamMailboxSettingsTest.teamMailboxExtraSenders |

### Mail — Users list, user detail UDT-01..14

| Case | Test |
|---|---|
| USR-01 | UsersListTest.prefixSearch |
| USR-02 | UsersListTest.domainFilter |
| USR-03 | UsersListTest.serverSidePagination (55 users in the test's own domain) |
| USR-04 | UsersListTest.openUserFromList |
| UDT-01 | UserDetailTest.mailboxesListCreateDelete |
| UDT-02 | UserDetailTest.clearMailboxContent |
| UDT-03 | UserDetailTest.quotaViewUpdateReset |
| UDT-04 | UserDetailTest.aliasesAddRemove |
| UDT-05 | UserDetailTest.forwardsAndUserStillReceives |
| UDT-06 | UserDetailTest.mappingsOfAUser |
| UDT-07 | UserDetailTest.teamMailboxesLeave |
| UDT-08 | UserDetailSettingsTest.vacationSaveDelete |
| UDT-09 | UserDetailSettingsTest.delegatedUsers |
| UDT-10 | UserDetailSettingsTest.allowedFromHeaders |
| UDT-11 | UserDetailSettingsTest.jmapIdentities |
| UDT-12 | UserDetailSettingsTest.labelsCreateEditDelete |
| UDT-13 | UserDetailSettingsTest.jmapSettings |
| UDT-14 | UserDetailSettingsTest.userRateLimits |

### Mail — User detail UDT-15..27, global quota, mappings

| Case | Test |
|---|---|
| UDT-15 | DeletedMessageVaultTest.searchAndRestore (the vault is fed unreliably on this stack, DeletedMessageVaultListenerGroup dead letters: 0 or 1 match accepted, restore round trip checked against what is found) |
| UDT-16 | MessageSearchTest.messageSearch (POST /users/{u}/mails is 404 on this backend: requests + readable error asserted, result rendering not) |
| UDT-17 | UserTasksTest.taskDialogsPreviewTheirCommand, reindexSubscribeAllRecomputeFastView |
| UDT-18 | UserTasksTest.cleanupTrashSpamAndTierData |
| UDT-19 | UserRenameAndDeleteTest.renameUser |
| UDT-20 | UserRenameAndDeleteTest.deleteAllMailboxes, deleteUserData |
| UDT-21 | UserDetailMiscTest.networkChannels (no IMAP/JMAP session from the host: listing an active session not asserted) |
| UDT-22 | UserDetailMiscTest.unknownUserDetail |
| UDT-23 | UserDetailSectionsTest.mappingSectionsRefreshTogether |
| UDT-24 | UserDetailSectionsTest.vacationMustEndAfterItStarts |
| UDT-25 | UserDetailSectionsTest.delegatedUsersSelfAndUnknown |
| UDT-26 | DeletedMessageVaultTest.incompleteCriteriaBlockSearchAndRestore, incompleteCriteriaInRestoreTaskDialog |
| UDT-27 | UserDetailMiscTest.followsAChangeOfUser |
| GQ-01 | GlobalQuotaTest.updateGlobalQuotaSize (lock MAIL_GLOBAL_QUOTA, /quota restored) |
| GQ-02 | GlobalQuotaTest.quotaReports |
| GQ-03 | GlobalQuotaTest.exploreUserQuotaRangeValidation (a failed search cannot be provoked) |
| MAP-01 | MappingsTest.addAndRemoveAddressMapping |
| MAP-02 | MappingsTest.regexAndDomainMappings |
| MAP-03 | MappingsTest.removeAliasAndForwardMappings |
| MAP-04 | MappingsTest.deleteMatchingMappings (search on the test's own domain, count typed to confirm) |

### Mail repositories, event dead letters, tasks, common tasks

| Case | Test |
|---|---|
| MR-01 | `MailRepositoriesTest.listMailRepositories` |
| MR-02 | `MailRepositoriesTest.createMailRepository` |
| MR-03 | `MailRepositoriesTest.bulkActions`, `reprocessParameters` |
| MR-04 | `MailRepositoriesTest.detailAndFilters`, `extendedView`, `perMailActions` |
| EDL-01 | `EventDeadLetterTest.groupsAndSearchByEventId` — Group / Insertion ID not asserted: WebAdmin does not expose `X-Group` / `X-Insertion-Id` (no `Access-Control-Expose-Headers`) |
| EDL-02 | `EventDeadLetterTest.groupDetailRedeliverAndDelete` |
| EDL-03 | `EventDeadLetterTest.redeliverDialog` |
| TSK-01 | `TasksTest.listDetailAndFullDetails` |
| TSK-02 | `TasksTest.filtersAndSort`, `TasksTest.staleListDoesNotOverwriteFilter`. Step 5 (sort across pages of > 50 tasks) not automated: the global list moves all the time |
| TSK-03 | `TasksTest.cancelRunningTask` |
| TSK-04 | `TasksTest.endDateOfCancelledTasks` (failed tasks: only the ones that happen to exist) |
| TSK-05 | `TasksTest.unknownOrMalformedTaskId` |
| CT-01 | `CommonTasksTest.runCommonTaskWithParameters` |
| CT-02 | `CommonTasksTest.otherCommonTasks` |
| CT-03 | `CommonTasksTest.perUserReindexing` |
| CT-04 | `CommonTasksTest.reloadCertificatesRepositionRightsCleanupOldTasks` |
| CT-05 | `CommonTasksTest.blobGarbageCollectionAndCleanups` (backend answers 404 on `DELETE /blobs`: asserts the error stays in the dialog) |
| CT-06 | `CommonTasksTest.clearingRateParameterRemovesItFromPreview` |

## Twake Calendar Admin

### Calendar — Navigation, health check, domains, domain admins, settings, contacts, domain tasks

| Case | Test |
|---|---|
| NAV-01 | NavigationTest.sidebarListsOnlyCalendarSections |
| NAV-02 | NavigationTest.mailOnlyRoutesRenderNothing |
| NAV-03 | NavigationTest.languageSelector |
| NAV-04 | NavigationTest.phoneLayout (no horizontal scroll checked; row-by-row layout of /tasks not checked) |
| NAV-05 | NavigationTest.docLinksPointToSideServiceDoc |
| HC-01 | HealthCheckTest.healthCheckPage (does not require every check healthy: other tests may degrade UnsentMails) |
| DOM-01 | DomainsListTest.domainListAndSearch |
| DOM-02 | DomainsListTest.createDomain |
| DOM-03 | DomainsListTest.deleteDomain (side service answers 500 "Not implemented": error toast asserted) |
| DOM-04 | DomainsListTest.importDomains |
| DOM-05 | DomainDetailTest.calendarDomainDetailPage |
| DADM-01 | DomainAdminsTest.addCalendarDomainAdmin |
| DADM-02 | DomainAdminsTest.searchAndRemoveDomainAdmin |
| DADM-03 | DomainAdminsTest.existingAdminCannotBeAddedAgain |
| DSET-01 | DomainSettingsTest.viewAndChangeDomainSettings (fresh domain) |
| DSET-02 | DomainSettingsTest.cancelAndBackToSystemDefault (fresh domain) |
| DCON-01 | DomainContactsTest.domainAddressBooksAndTheirActions |
| DCON-02 | DomainContactsTest.importVCardsIntoDomainAddressBook (env: 404 address book does not exist; request + error asserted) |
| DCON-03 | DomainContactsTest.copyUsersFromAnotherDomain (env: 400, translated message asserted) |
| DCON-04 | DomainContactsTest.clearDomainAddressBook (env: 404, translated message asserted) |
| DTASK-01 | DomainTasksTest.syncDomainMembers (env: route missing, 404 toast asserted) |
| DTASK-02 | DomainTasksTest.republishDomainCommonContacts (env: 404 in the dialog, values kept) |
| DTASK-03 | DomainTasksTest.deleteAllUsersDataOfDomain (fresh domain only) |
| X-01 | DomainContactsTest.toastsStayReadableWhileDialogIsOpen |
| X-02 | DialogLayoutTest.longUnbreakableWordsStayInsideDialogs |

### Calendar — Calendar resources, team calendars

| Case | Test |
|---|---|
| RES-01 | CalendarResourcesTest.createCalendarResource |
| RES-02 | ResourceDetailTest.resourceDetailAndEdit |
| RES-03 | ResourceDetailTest.manageResourceAdministrators |
| RES-04 | CalendarResourcesTest.deleteCalendarResource |
| RES-05 | ResourceContentTest.importCountAndExportResourceEvents |
| RES-06 | ResourceContentTest.resourcePublicVisibility (no WebAdmin GET for the public right: toast + dialog asserted) |
| RES-07 | CalendarResourcesTest.resourcesWithoutNameOrWithUnknownIcon (sort position not asserted: shared list) |
| TCAL-01 | TeamCalendarsTest.createTeamCalendar |
| TCAL-02 | TeamCalendarsTest.editTeamCalendarDisplayName |
| TCAL-03 | TeamCalendarMembersTest.manageTeamCalendarMembers (colours of staged/changed members not asserted) |
| TCAL-04 | TeamCalendarsTest.deleteTeamCalendar |
| TCAL-05 | TeamCalendarMembersTest.importCountAndExportTeamCalendarEvents |
| TCAL-06 | TeamCalendarsTest.teamCalendarPublicVisibilityAndSearch |

### Calendar — Users, user calendars, user address books

| Case | Test |
|---|---|
| USR-01 | UsersTest.userListPrefixSearchAndDomainFilter |
| USR-02 | UsersTest.registeredUserDetailPage |
| USR-03 | UsersTest.registerUnregisteredUserFromDetailPage |
| USR-04 | UsersTest.navigatingToAnotherUserResetsThePage |
| UCAL-01 | UserCalendarsTest.createCalendar |
| UCAL-02 | UserCalendarsTest.editCalendar |
| UCAL-03 | UserCalendarsTest.deleteCalendar |
| UCAL-04 | UserCalendarsTest.calendarPublicVisibility |
| UCAL-05 | UserCalendarDelegationTest.delegateCalendarToAnotherUser |
| UCAL-06 | UserCalendarDelegationTest.changeAndRemoveCalendarInvitee |
| UCAL-07 | UserCalendarsTest.importCountAndExportEvents |
| UCAL-08 | UserCalendarsTest.calendarColourValidation |
| UCAL-09 | UserCalendarsTest.mainCalendarCannotBeDeleted |
| UCAL-10 | UserCalendarDelegationTest.ownerCannotBeInvitedToOwnCalendar |
| UAB-01 | UserAddressBooksTest.createEditAndDeleteAddressBook |
| UAB-02 | UserAddressBooksTest.importCountAndExportContacts |
| UAB-03 | UserAddressBookSharingTest.shareAddressBook |
| UAB-04 | UserAddressBooksTest.addressBookPublicVisibility |
| UAB-05 | UserAddressBooksTest.systemAddressBooksAreLabelledAndProtected |
| UAB-06 | UserAddressBookSharingTest.ownerCannotBeShareeOfOwnAddressBook |
| UAB-07 | UserAddressBookSharingTest.administrationShareKeepsSharingAndVisibility |

### Calendar — Booking links, user tasks, registered users, unsent mails, tasks, common tasks

| Case | Test |
|---|---|
| BOOK-01 | BookingLinksTest.createBookingLink |
| BOOK-02 | BookingLinksTest.editBookingLinkAndRules (French plural not asserted) |
| BOOK-03 | BookingLinksTest.duplicateBookingLink |
| BOOK-04 | BookingLinksTest.resetPublicId |
| BOOK-05 | BookingLinksTest.deleteBookedEventsAndLink |
| BOOK-06 | BookingLinksTest.onlyBookableCalendarsAreOffered |
| BOOK-07 | BookingLinksTest.durationFieldValidation |
| BOOK-08 | BookingLinksTest.calendarDropdownFollowsCalendarsSection |
| UTASK-01 | UserTasksTest.archiveUserCalendarEvents |
| UTASK-02 | UserTasksTest.republishUserCommonContacts (env: route missing, 404 in the dialog asserted) |
| UTASK-03 | UserTasksTest.deleteUserData |
| UTASK-04 | UserTasksTest.refusedUserTaskKeepsDialogOpen |
| REG-01 | RegisteredUsersTest.registeredUsersListAndSearch (own users, not absolute totals) |
| REG-02 | RegisteredUsersTest.registerUserFromList |
| REG-03 | RegisteredUsersTest.editRegisteredUser |
| REG-04 | RegisteredUsersTest.deleteRegisteredUser |
| REG-05 | RegisteredUsersTest.editRegisteredUserValidation |
| UNS-01 | UnsentMailsTest.unsentMailsPageAndFilters (real unsent iMIP mails: mock-smtp refuses a per-test recipient) |
| UNS-02 | UnsentMailsTest.bulkResendAndDeleteCarryTheFilters |
| UNS-03 | UnsentMailsTest.unsentMailDetail |
| UNS-04 | UnsentMailsTest.bulkActionsNeedCompleteAddresses |
| TASK-01 | TasksTest.taskListAndDetailDialog |
| TASK-02 | TasksTest.taskFiltersAndSorting |
| TASK-03 | TasksTest.taskDetailPage (Cancel button checked on a routed inProgress answer) |
| TASK-04 | TasksTest.taskDetailOfUnknownOrMalformedId |
| CT-01 | CommonTasksTest.calendarCommonTasksListed |
| CT-02 | CommonTasksTest.importLdapUsers (env: route missing, request + 404 asserted) |
| CT-03 | CommonTasksTest.taskParametersReflectedInCommandPreview |
| CT-04 | CommonTasksTest.rejectedTaskKeepsDialogOpen |
| CT-05 | CommonTasksTest.otherCalendarMaintenanceTasksRun (archival: dialog + preview only, it would archive every user; reindex: accepted then cancelled, ~100 s otherwise) |
| CT-06 | CommonTasksTest.deleteDomainMembersContactsOfAllDomains (env: route missing, 404 asserted) |

