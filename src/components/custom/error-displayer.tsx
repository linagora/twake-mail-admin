import { useMemo } from "react";
import { toErrorMessage } from "./error-message";

interface Props {
  error: unknown;
}

const ErrorDisplayer: React.FC<Props> = ({ error }) => {
  const { message, details } = useMemo(() => toErrorMessage(error), [error]);

  return (
    <div className="max-h-[300px] max-w-[330px] overflow-auto break-words">
      <p>{message}</p>
      {details && <p className="mt-1 text-xs opacity-80">{details}</p>}
    </div>
  );
};

export default ErrorDisplayer;
