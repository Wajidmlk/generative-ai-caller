"use client";

import * as Dialog from "@radix-ui/react-dialog";

export function Modal({
  open,
  title,
  subtitle,
  wide,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="rd-overlay" />
        <Dialog.Content className={`rd-content ${wide ? "wide" : ""}`} aria-describedby={undefined}>
          <div className="modal-head">
            <div>
              <Dialog.Title className="rd-title">{title}</Dialog.Title>
              {subtitle ? (
                <Dialog.Description className="rd-desc">{subtitle}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button className="btn ghost sm" type="button" aria-label="Close">
                Close
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
