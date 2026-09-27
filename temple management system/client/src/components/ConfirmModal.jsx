import { Trash2 } from 'lucide-react';
import Modal from './Modal.jsx';

/**
 * Reusable delete-confirmation modal.
 *
 * Props:
 *   open    : bool
 *   title   : string  — modal heading
 *   message : string  — body text
 *   onConfirm : () => void
 *   onClose   : () => void
 *   busy    : bool    — disables confirm button while request in flight
 *   confirmLabel : string  — defaults to "Delete"
 *   danger  : bool    — red confirm button (default true)
 */
export default function ConfirmModal({ open, title = 'Confirm delete', message, onConfirm, onClose, busy = false, confirmLabel = 'Delete', danger = true, error, children, confirmDisabled = false }) {
  return (
    <Modal title={title} open={open} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-800">{message}</p>
        {children}
        {error && <p className="text-sm text-kumkum-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? 'Deleting…' : <><Trash2 size={15} /> {confirmLabel}</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
