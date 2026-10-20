import type { Invoice, InvoiceInput, SendInvoiceInput } from "@invoice/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const queryKeys = {
  invoices: ["invoices"] as const,
  invoice: (id: string) => ["invoices", id] as const,
  defaults: ["invoices", "defaults"] as const,
};

export function useInvoices() {
  return useQuery({ queryKey: queryKeys.invoices, queryFn: api.listInvoices });
}

export function useInvoice(id: string) {
  return useQuery({ queryKey: queryKeys.invoice(id), queryFn: () => api.getInvoice(id) });
}

export function useInvoiceDefaults() {
  // Always fresh: the suggested number depends on invoices created moments ago.
  return useQuery({ queryKey: queryKeys.defaults, queryFn: api.getDefaults, staleTime: 0, gcTime: 0 });
}

/** Writes the server's version of an invoice into the cache and refreshes the list. */
function useCacheInvoice() {
  const queryClient = useQueryClient();
  return (invoice: Invoice) => {
    queryClient.setQueryData(queryKeys.invoice(invoice.id), invoice);
    void queryClient.invalidateQueries({ queryKey: queryKeys.invoices, exact: true });
  };
}

export function useSaveInvoice() {
  const cacheInvoice = useCacheInvoice();
  return useMutation({
    mutationFn: ({ id, data }: { id: string | null; data: InvoiceInput }) =>
      id ? api.updateInvoice(id, data) : api.createInvoice(data),
    onSuccess: cacheInvoice,
  });
}

export function useSendInvoice() {
  const cacheInvoice = useCacheInvoice();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SendInvoiceInput }) => api.sendInvoice(id, data),
    onSuccess: (result) => cacheInvoice(result.invoice),
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteInvoice(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.invoice(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices, exact: true });
    },
  });
}
