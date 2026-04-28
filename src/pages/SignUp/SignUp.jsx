import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, UserPlus, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import './SignUp.css';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: signUpError } = await signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (signUpError) throw signUpError;

      // Se o usuário removeu a confirmação de e-mail, ele já deve estar logado ou pronto para logar
      // Supabase geralmente loga automaticamente se a confirmação estiver desativada
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card animate-fadeInUp">
        <div className="signup-header">
          <Link to="/login" className="btn-back">
            <ArrowLeft size={20} />
          </Link>
          <div className="logo-placeholder">Nexus</div>
          <h1>Crie sua conta</h1>
          <p>Comece a gerenciar seu dashboard agora mesmo</p>
        </div>

        {error && (
          <div className="signup-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignUp} className="signup-form">
          <div className="form-group">
            <label>Nome Completo</label>
            <div className="input-wrap">
              <User size={16} />
              <input 
                type="text" 
                placeholder="Seu nome" 
                value={fullName} 
                onChange={e => setFullName(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label>E-mail</label>
            <div className="input-wrap">
              <Mail size={16} />
              <input 
                type="email" 
                placeholder="seu@email.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Senha</label>
            <div className="input-wrap">
              <Lock size={16} />
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                minLength={6}
              />
            </div>
          </div>

          <button type="submit" className="btn-signup" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={20} /> Criar Conta</>}
          </button>
        </form>

        <div className="signup-footer">
          <p>Já possui uma conta? <Link to="/login">Fazer login</Link></p>
        </div>
      </div>
    </div>
  );
}
