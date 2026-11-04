import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Card, CardBody } from "@/components/ui/Card";
import { Logo } from "@/components/Logo";

const queryClient = new QueryClient();

function Placeholder() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center text-center py-10 gap-4">
          <Logo variant="full" />
          <div>
            <h1 className="text-lg font-semibold text-navy">JXB-MR</h1>
            <p className="text-xs text-content-secondary mt-1">
              Enterprise Risk Management System
            </p>
          </div>
          <p className="text-xs text-content-muted">
            Fondasi proyek berjalan. Halaman login diterapkan pada langkah berikutnya.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Placeholder />
    </QueryClientProvider>
  );
}
