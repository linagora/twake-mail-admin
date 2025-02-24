interface Props {
  error: any;
}

const ErrorDisplayer: React.FC<Props> = ({ error }) => {
  return (
    <div className="h-[300px] w-[330px] overflow-auto">
      <pre>{JSON.stringify(error, null, 2)}</pre>,
    </div>
  );
};

export default ErrorDisplayer;
