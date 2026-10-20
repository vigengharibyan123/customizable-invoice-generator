import type {
  ApiErrorBody,
  Invoice,
  InvoiceInput,
  InvoiceSummary,
  NewInvoiceDefaults,
  SendInvoiceInput,
} from "@invoice/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorBody["error"]["code"] | "NETWORK";
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    super(body?.error.message ?? fallback);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error.code ?? (status === 0 ? "NETWORK" : "INTERNAL");
    this.fieldErrors = body?.error.fieldErrors ?? {};
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiError(0, null, "Can't reach the server. Check that the API is running and try again.");
  }
  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body as ApiErrorBody | null, `Request failed (${response.status})`);
  }
  return body as T;
}

export interface SendResult {
  invoice: Invoice;
  delivery: { mode: "smtp" | "ethereal" | "json"; previewUrl: string | null };
}

export const api = {
  listInvoices: () => request<{ invoices: InvoiceSummary[] }>("/invoices").then((r) => r.invoices),
  getInvoice: (id: string) => request<{ invoice: Invoice }>(`/invoices/${id}`).then((r) => r.invoice),
  getDefaults: () => request<NewInvoiceDefaults>("/invoices/defaults"),
  createInvoice: (data: InvoiceInput) =>
    request<{ invoice: Invoice }>("/invoices", { method: "POST", body: JSON.stringify(data) }).then(
      (r) => r.invoice,
    ),
  updateInvoice: (id: string, data: InvoiceInput) =>
    request<{ invoice: Invoice }>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(data) }).then(
      (r) => r.invoice,
    ),
  deleteInvoice: (id: string) => request<void>(`/invoices/${id}`, { method: "DELETE" }),
  sendInvoice: (id: string, data: SendInvoiceInput) =>
    request<SendResult>(`/invoices/${id}/send`, { method: "POST", body: JSON.stringify(data) }),
};
