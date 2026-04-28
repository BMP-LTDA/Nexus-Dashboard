import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Store, Globe, Hash, Palette, Loader2, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import './CreateStoreModal.css';

const DEFAULT_ICONS = ['🛍️', '🏪', '⚡', '🔥', '🚀', '💎', '📦', '🛒'];
const DEFAULT_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#06B6D4'];

export default function StoreModal({ onClose, onSuccess, initialData = null }) {
  const { user, isAdmin, refreshAccounts } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!initialData;
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    icon: initialData?.icon || DEFAULT_ICONS[0],
    color: initialData?.color || DEFAULT_COLORS[0],
    owner_id: initialData?.owner_id || user?.id
  });

  const handleNameChange = (e) => {
    const name = e.target.value;
    const slug = name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    setFormData(prev => ({ ...prev, name, slug: isEdit ? prev.slug : slug }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        icon: formData.icon,
        color: formData.color,
        owner_id: formData.owner_id
      };

      if (isEdit) {
        const { error: updateError } = await supabase
          .from('accounts')
          .update(payload)
          .eq('id', initialData.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('accounts')
          .insert([payload]);
        if (insertError) throw insertError;
      }

      await refreshAccounts();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-fadeInUp" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-title">
            <div className="icon-badge">
              <Store size={20} />
            </div>
            <div>
              <h3>{isEdit ? 'Editar Loja' : 'Nova Loja'}</h3>
              <p>{isEdit ? 'Atualize as informações da loja' : 'Configure sua nova loja no Nexus'}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && (
            <div className="modal-error">
              <span>{error}</span>
            </div>
          )}

          <div className="form-grid">
            <div className="form-group">
              <label>Nome da Loja</label>
              <div className="input-wrap">
                <Store size={16} />
                <input 
                  type="text" 
                  placeholder="Ex: Minha Loja" 
                  value={formData.name}
                  onChange={handleNameChange}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Link (slug)</label>
              <div className="input-wrap" style={{ opacity: isEdit ? 0.6 : 1 }}>
                <Globe size={16} />
                <input 
                  type="text" 
                  placeholder="ex-loja" 
                  value={formData.slug}
                  disabled={isEdit}
                  onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  required 
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Ícone Sugerido</label>
            <div className="icon-selector">
              {DEFAULT_ICONS.map(icon => (
                <button 
                  key={icon}
                  type="button"
                  className={`icon-btn ${formData.icon === icon ? 'active' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, icon }))}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Cor Identidade</label>
            <div className="color-selector">
              {DEFAULT_COLORS.map(color => (
                <button 
                  key={color}
                  type="button"
                  className={`color-btn ${formData.color === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                >
                  {formData.color === color && <Check size={14} color="#fff" />}
                </button>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="form-group">
              <label>ID do Proprietário (Opcional - Admin)</label>
              <div className="input-wrap">
                <Hash size={16} />
                <input 
                  type="text" 
                  placeholder="ID do usuário cliente" 
                  value={formData.owner_id || ''}
                  onChange={e => setFormData(prev => ({ ...prev, owner_id: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : isEdit ? 'Salvar Alterações' : 'Criar Loja'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
