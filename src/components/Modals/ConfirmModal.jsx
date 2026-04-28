import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import './ConfirmModal.css';

export default function ConfirmModal({ 
  title, 
  message, 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar', 
  onConfirm, 
  onClose, 
  loading = false,
  variant = 'danger' 
}) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content confirm-modal animate-fadeInUp" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon-wrap" style={{ 
          background: variant === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          color: variant === 'danger' ? '#EF4444' : '#F59E0B'
        }}>
          <AlertTriangle size={24} />
        </div>
        
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        
        <div className="confirm-footer">
          <button 
            type="button" 
            className="btn-cancel" 
            onClick={onClose} 
            disabled={loading}
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            className={`btn-confirm ${variant}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
