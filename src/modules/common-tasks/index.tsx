import { ReIndexMode, TaskKey, TaskProps } from "./types";
import TaskContainer from "./task-container";
import Header from "@/components/custom/header";

const TASKS: TaskProps[] = [
  {
    name: 'Reindex all data in OpenSearch (fix outdated mode)',
    taskKey: TaskKey.REINDEX,
    mode: ReIndexMode.FIX_OUTDATED,
    command: 'curl -XPOST /mailboxes?task=reIndex&mode=fixOutdated',
    params: [
      { key: 'messagesPerSecond', defaultValue: '50', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_reindexing_action',
  },
  {
    name: 'Reindex all data in OpenSearch (reindex all mode)',
    taskKey: TaskKey.REINDEX,
    mode: ReIndexMode.REBUILD_ALL,
    command: 'curl -XPOST /mailboxes?task=reIndex&mode=rebuildAll',
    params: [
      { key: 'messagesPerSecond', defaultValue: '50', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_reindexing_action',
  },
  {
    name: 'Fix mailbox inconsistencies',
    taskKey: TaskKey.FIX_MAILBOX_INCONSISTENCIES,
    command: 'curl -XPOST /mailboxes?task=SolveInconsistencies',
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_fixing_mailboxes_inconsistencies',
  },
  {
    name: 'Fix message inconsistencies',
    taskKey: TaskKey.FIX_MESSAGE_INCONSISTENCIES,
    command: 'curl -XPOST /messages?task=SolveInconsistencies',
    params: [
      { key: 'messagesPerSecond', defaultValue: '100', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_fixing_message_inconsistencies_2',
  },
  {
    name: 'Recompute mailbox counters',
    taskKey: TaskKey.RECOMPUTE_MAILBOX_COUNTERS,
    command: 'curl -XPOST /mailboxes?task=RecomputeMailboxCounters',
    params: [
      { key: 'trustMessageProjection', defaultValue: false, type: 'checkbox' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_recomputing_mailbox_counters',
  },
  {
    name: 'Recompute mailbox quota',
    taskKey: TaskKey.RECOMPUTE_MAILBOX_QUOTA,
    command: 'curl -XPOST /quota/users?task=RecomputeCurrentQuotas',
    params: [
      { key: 'usersPerSecond', defaultValue: '1', type: 'input' },
      { key: 'quotaComponent', values: ['MAILBOX', 'SIEVE', 'JMAP_UPLOADS'], type: 'select' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_recomputing_current_quotas_for_users',
  },
  {
    name: 'Fix mapping denormalization',
    taskKey: TaskKey.FIX_MAPPING_DENORMALIZATION,
    command: 'curl -XPOST /cassandra/mappings?action=SolveInconsistenciescurl -XPOST /cassandra/mappings?action=SolveInconsistencies',
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_operations_on_mappings_sources',
  },
  {
    name: 'Cleanup JMAP uploads',
    taskKey: TaskKey.CLEANUP_JMAP_UPLOADS,
    command: 'curl -XDELETE /jmap/uploads?scope=expired',
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_cleaning_upload_repository',
  },
  {
    name: 'Blob garbage collection',
    taskKey: TaskKey.BLOB_GARBAGE_COLLECTION,
    command: 'curl -XDELETE /blobs?scope=unreferenced',
    params: [
      { key: 'associatedProbability', defaultValue: '0.01', type: 'input' },
      { key: 'expectedBlobCount', defaultValue: '1.000.000', type: 'input' },
    ],
    doc: 'https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_running_blob_garbage_collection',
  },
];

const headerSubTitle = "Common tasks for data maintenance of a Twake Mail server";

const docuUrl = "https://james.staged.apache.org/james-project/3.9.0/servers/distributed/operate/webadmin.html#_task_management";

export default function CommonTasks() {
  return (
    <div className="p-4 relative w-fit">
      <Header
        headerSubTitle={headerSubTitle}
        docuUrl={docuUrl}
      />

      <div className="grid grid-cols-1 gap-4 mt-4">
        {TASKS?.map((task) => (
          <TaskContainer {...task} key={task.name} />
        ))}
      </div>
    </div>
  );
}
