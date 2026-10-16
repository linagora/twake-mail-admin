import { Fragment, ReactNode } from "react";
import { useParams } from "react-router";

// React Router keeps a route element mounted when only its URL parameters change (e.g. navigating from
// one user page to another), so the previous entity's state would leak into the new page.
// Keying the children by the parameters remounts them with a fresh state instead.
export default function RemountOnParamsChange({ children }: { children: ReactNode }) {
  const params = useParams();
  return <Fragment key={JSON.stringify(params)}>{children}</Fragment>;
}
