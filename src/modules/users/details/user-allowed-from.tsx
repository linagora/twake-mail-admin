import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useFetchData } from "@/hooks/use-fetch-data";
import { getAllowedFromHeaders } from "../api-client";

interface Props {
  username: string;
}

export default function UserAllowedFrom({ username }: Props) {
  const fetchHeaders = useCallback(() => getAllowedFromHeaders(username), [username]);
  const { data: headers, isLoading, error } = useFetchData<string[]>(fetchHeaders);

  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-md font-semibold hover:text-blue-600 transition"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        Allowed From Headers
        {headers && (
          <span className="text-sm font-normal text-gray-500">
            ({headers.length})
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2">
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="h-[58px] rounded-2 animate-pulse bg-gray-200" />
            </div>
          )}
          {error && <p className="text-red-500 mt-2">Error: {error}</p>}

          {headers && (
            <div>
              {headers.map((header, index) => (
                <div
                  key={header}
                  className="p-4 bg-gray-50 rounded-2 my-2"
                >
                  <h4 className="text-sm font-medium leading-none">
                    <span className="text-gray-500 mr-2">{index + 1}/</span>
                    {header}
                  </h4>
                </div>
              ))}
              {headers.length === 0 && (
                <p className="mt-2 text-sm text-gray-500">No allowed From headers.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
