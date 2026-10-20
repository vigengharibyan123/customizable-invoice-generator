import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { NotFoundPage } from "@/components/not-found-page";
import { InvoiceEditorPage } from "@/features/invoice/editor/invoice-editor-page";
import { InvoicesPage } from "@/features/invoice/list/invoices-page";

const queryClient = new QueryClient({
  defaultOptions: {
    // Editing happens locally; refetching on focus would only cause surprise.
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30_000 },
  },
});

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/invoices" replace /> },
      { path: "invoices", element: <InvoicesPage /> },
      { path: "invoices/new", element: <InvoiceEditorPage /> },
      { path: "invoices/:invoiceId", element: <InvoiceEditorPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{ className: "print:hidden font-sans", duration: 6000 }}
      />
    </QueryClientProvider>
  );
}
