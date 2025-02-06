interface HeaderProps {
  headerTitle?: string;
  headerSubTitle: string;
  docuUrl: string;
}

const Header: React.FC<HeaderProps> = ({
  headerTitle,
  headerSubTitle,
  docuUrl,
}) => {
  return (
    <>
      {headerTitle && (
        <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
          {headerTitle} (
          <a href={docuUrl} target="_blank" className="text-blue-500 underline">
            doc
          </a>
          )
        </h2>
      )}
      <p className="leading-7 mt-4">
        {headerSubTitle} (
        <a href={docuUrl} target="_blank" className="text-blue-500 underline">
          doc
        </a>
        )
      </p>
    </>
  );
};

export default Header;
