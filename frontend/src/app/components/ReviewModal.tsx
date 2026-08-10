// Modal para dejar reseña post-participación
// Se usa desde MyParticipation cuando status === 'approved'
import { useState } from 'react';
import { Star, X, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface Props {
  projectId: string;
  projectTitle: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ReviewModal({ projectId, projectTitle, onClose, onSaved }: Props) {
  const [rating, setRating]   = useState(0);
  const [hover, setHover]     = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  const handleSave = async () => {
    if (rating === 0) { setErr('Seleccioná una calificación'); return; }
    setSaving(true); setErr('');
    try {
      await api.projects.rate(projectId, rating, comment.trim() || undefined);
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const LABELS = ['', 'Muy malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="px-6 pt-4 pb-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-bold text-lg text-gray-900">Dejar reseña</h2>
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{projectTitle}</p>
            </div>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Stars */}
          <div className="text-center mb-5">
            <div className="flex justify-center gap-2 mb-2">
              {[1,2,3,4,5].map(n => (
                <button key={n}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="transition-transform hover:scale-110 active:scale-95">
                  <Star className={`w-10 h-10 transition-colors ${
                    n <= (hover || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-200'
                  }`} />
                </button>
              ))}
            </div>
            {(hover || rating) > 0 && (
              <p className="text-sm font-semibold text-gray-700 h-5">
                {LABELS[hover || rating]}
              </p>
            )}
          </div>

          {/* Comment */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">
              Comentario <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="¿Cómo fue tu experiencia en este voluntariado?"
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-400"
            />
          </div>

          {err && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl mb-3">{err}</p>}

          <button onClick={handleSave} disabled={saving || rating === 0}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Publicar reseña
          </button>
        </div>
      </div>
    </div>
  );
}
