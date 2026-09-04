import { LoaderIcon } from 'lucide-react';

function PageLoader() {
  return (
    <div className='flex items-center justify-center h-screen bg-oat'>
      <LoaderIcon className="size-10 animate-spin text-forest" />
    </div>
  );
}

export default PageLoader;