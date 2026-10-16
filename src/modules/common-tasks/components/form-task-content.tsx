import { ReactNode, useCallback, useState } from "react";
import ConfirmTaskContent from "./confirm-task-content";

interface Props<V> {
  initialValues: V;
  renderForm: (onChange: (values: V) => void) => ReactNode;
  buildCommand: (values: V) => string;
  onChange: (values: V) => void;
}

// Confirmation content of a task driven by its own form: the "Command:" preview follows the
// values the operator is typing, so that it shows the WebAdmin call that will actually be made.
export default function FormTaskContent<V>({ initialValues, renderForm, buildCommand, onChange }: Props<V>) {
  const [values, setValues] = useState(initialValues);

  // Stable, as some forms report their values from an effect depending on their `onChange`
  const handleChange = useCallback((next: V) => {
    setValues(next);
    onChange(next);
  }, [onChange]);

  return <ConfirmTaskContent message={renderForm(handleChange)} command={buildCommand(values)} />;
}
