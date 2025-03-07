import axios from "axios";
import { useMemo } from "react";

interface Props {
  error: any;
}

const ErrorDisplayer: React.FC<Props> = ({ error }) => {
  const fullError = useMemo(() => {
    if (axios.isAxiosError(error)) {
      return JSON.stringify({
        message: error.message,
        name: error.name,
        code: error.code || null,
        stack: error.stack || null,
        config: error.config,
        response: error.response
          ? {
              status: error.response.status,
              statusText: error.response.statusText,
              headers: error.response.headers,
              data: error.response.data,
            }
          : null,
        request: error.request ? "[Request Object Exists]" : null, // Request object isn't serializable
      }, null, 2);
    } else {
      return JSON.stringify(error, null, 2);
    }
  }, [error]);

  return (
    <div className="h-[300px] w-[330px] overflow-auto">
      <pre>{fullError}</pre>,
    </div>
  );
};

export default ErrorDisplayer;
