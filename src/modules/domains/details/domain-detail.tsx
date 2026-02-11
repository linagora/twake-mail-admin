import { useParams } from "react-router";

export default function DomainDetail() {
  const { domain } = useParams();

  return (
    <div className="mt-4 p-4 bg-white rounded-2">
      <h3 className="text-lg font-semibold">Domain Details</h3>
      <p>Domain: {domain}</p>
    </div>
  );
}
