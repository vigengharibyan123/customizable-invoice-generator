import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function NotFoundPage({
  title = "Page not found",
  message = "The page you're looking for doesn't exist or was moved.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="font-display text-6xl font-semibold text-accent/25" aria-hidden>
        404
      </p>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-ink-muted">{message}</p>
      <Button asChild variant="primary">
        <Link to="/invoices">Back to invoices</Link>
      </Button>
    </div>
  );
}
