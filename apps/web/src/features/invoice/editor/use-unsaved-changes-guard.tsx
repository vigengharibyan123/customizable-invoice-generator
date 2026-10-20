import { useEffect, useRef } from "react";
import { useBlocker } from "react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";

/**
 * Protects unsaved edits: asks before in-app navigation and before closing or reloading the tab.
 * `allowNextNavigation` lets the editor navigate itself right after a successful save.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  const dirtyRef = useRef(isDirty);
  const bypassRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !bypassRef.current && dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current && !bypassRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const dialog = (
    <Dialog open={blocker.state === "blocked"} onOpenChange={(open) => !open && blocker.reset?.()}>
      <DialogContent>
        <DialogHeader
          title="Discard unsaved changes?"
          description="You have edits that haven't been saved. If you leave now, they'll be lost."
        />
        <DialogFooter>
          <Button onClick={() => blocker.reset?.()}>Keep editing</Button>
          <Button variant="primary" className="bg-danger hover:bg-danger/90" onClick={() => blocker.proceed?.()}>
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return {
    allowNextNavigation: () => {
      bypassRef.current = true;
    },
    dialog,
  };
}
