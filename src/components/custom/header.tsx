import { ChevronLeft } from "lucide-react";
import { Button } from "../ui/button";
import { useNavigate } from "react-router";
import { ReactNode } from "react";

interface HeaderProps {
  headerTitle?: string | ReactNode;
  headerSubTitle?: string | ReactNode;
  docuUrl: string;
  enableBackBtn?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  headerTitle,
  headerSubTitle,
  docuUrl,
  enableBackBtn,
}) => {
  const navigate = useNavigate();

  const backToPreviousPage = () => {
    navigate(-1);
  }

  return (
    <div className="flex items-center">
      {enableBackBtn && (
        <Button className="hover:bg-gray-300" variant="ghost" size="icon" onClick={backToPreviousPage}>
          <ChevronLeft />
        </Button>
      )}
      <div>
        {headerTitle && (
          <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
            {headerTitle} (
            <a href={docuUrl} target="_blank" className="text-blue-500 underline">
              doc
            </a>
            )
          </h2>
        )}
        {headerSubTitle && (
          <p className={`leading-7 text-muted-foreground ${headerTitle ? 'mt-4' : ''}`}>
            {headerSubTitle}{!headerTitle && (<> (<a href={docuUrl} target="_blank" className="text-blue-500 underline">doc</a>)</>)}
          </p>
        )}
      </div>
    </div>
  );
};

export default Header;
