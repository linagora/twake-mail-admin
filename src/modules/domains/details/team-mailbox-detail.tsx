import { useParams } from "react-router";

export default function TeamMailboxDetail() {
  const { domain, mailbox } = useParams();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Team Mailbox Details</h3>
      <p>Mailbox: {mailbox}@{domain}</p>
    </div>
  );
}
