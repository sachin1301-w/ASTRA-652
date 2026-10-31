import { motion } from 'framer-motion'
import { AlertTriangle, Bot, BrainCircuit, Download, FileText, Image as ImageIcon, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DOCUMENT_TYPES, documentTypeLabel } from '../constants/documentTypes'
import { analyzeDocument, deleteDocument, downloadDocument, getDocument, listDocuments } from '../services/financeService'

const FILTERS = [{ value: 'all', label: 'All Documents' }, ...DOCUMENT_TYPES]

const MEMORY_STATUS = {
  added: { label: 'In financial memory', className: 'border border-[#00baf2]/30 bg-[#e7f6fd] text-[#002970]' },
  pending: { label: 'Adding to memory...', className: 'border border-amber-200 bg-amber-50 text-amber-700 animate-pulse' },
  failed: { label: 'Memory unavailable', className: 'border border-red-200 bg-red-50 text-red-600' },
  disabled: { label: 'Memory disabled', className: 'border border-gray-200 bg-gray-50 text-gray-500' },
}

export default function DocumentHistory({ geminiModel }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError('')
    listDocuments(filter)
      .then((data) => {
        if (!cancelled) setDocuments(data.documents || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load your documents.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter])

  async function handleDelete(id) {
    if (!window.confirm('Delete this document? This cannot be undone.')) return
    setBusyId(id)
    setError('')
    try {
      await deleteDocument(id)
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
    } catch (err) {
      setError(err.message || 'Unable to delete this document.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReanalyze(id) {
    setBusyId(id)
    setError('')
    try {
      const result = await analyzeDocument(id, geminiModel)
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id
            ? { ...doc, summary: result.summary, processing_status: 'analyzed', memory_status: 'pending' }
            : doc,
        ),
      )
    } catch (err) {
      setError(err.message || 'Unable to re-analyze this document right now.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleAsk(id, filename, documentType) {
    setBusyId(id)
    setError('')
    try {
      const doc = await getDocument(id)
      navigate('/assistant', {
        state: {
          document: {
            filename: doc.filename || filename,
            documentType: doc.document_type || documentType,
            summary: doc.summary,
            fields: doc.fields || {},
            risks: doc.risks || [],
          },
        },
      })
    } catch (err) {
      setError(err.message || 'Unable to open this document for chat right now.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <motion.button
            key={item.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
              filter === item.value
                ? 'bg-gradient-to-r from-[#002970] to-[#0041a8] text-white shadow-sm shadow-[#002970]/20'
                : 'border border-[#e3edf7] bg-white text-[#526484] hover:border-[#00baf2] hover:text-[#002970]'
            }`}
          >
            {item.label}
          </motion.button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-sm font-semibold">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-3 rounded-3xl border border-[#e3edf7] bg-white p-12 text-[#002970]">
          <Loader2 className="h-6 w-6 animate-spin text-[#00baf2]" />
          <span className="text-sm font-bold">Loading your financial documents...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-[#e3edf7] bg-white p-12 text-center text-[#64748b]">
          <FileText className="mx-auto mb-3 h-10 w-10 text-[#00baf2]/40" />
          <p className="text-base font-bold text-[#002970]">No documents in this category yet</p>
          <p className="mt-1 text-xs">Upload your agreements, bills, or tax returns above to begin analysis.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {documents.map((doc, idx) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
              className="paytm-card rounded-2xl p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#002970]/10 to-[#00baf2]/10 text-[#002970]">
                    {doc.content_type === 'application/pdf' ? (
                      <FileText className="h-6 w-6 text-[#002970]" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-[#00baf2]" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <p className="text-base font-extrabold text-[#002970]">{doc.filename}</p>
                    <p className="text-xs font-semibold text-[#64748b]">{documentTypeLabel(doc.document_type)}</p>
                    <p className="mt-0.5 text-[11px] text-[#94a3b8]">
                      Uploaded {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      doc.processing_status === 'analyzed'
                        ? 'border border-[#00b368]/30 bg-[#e8f9f1] text-[#00b368]'
                        : 'border border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {doc.processing_status === 'analyzed' ? '✓ Analyzed' : '⏳ Uploaded'}
                  </span>
                  {doc.processing_status === 'analyzed' && MEMORY_STATUS[doc.memory_status] && (
                    <span
                      title={doc.memory_status === 'failed' ? 'Cognee could not process this document, but it stays saved.' : undefined}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${MEMORY_STATUS[doc.memory_status].className}`}
                    >
                      <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
                      {MEMORY_STATUS[doc.memory_status].label}
                    </span>
                  )}
                </div>
              </div>

              {doc.summary && (
                <p className="mt-3 rounded-xl bg-[#f8fbfe] p-3 text-xs leading-relaxed text-[#334155]">
                  {doc.summary}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e3edf7] pt-3">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => handleAsk(doc.id, doc.filename, doc.document_type)}
                  disabled={busyId === doc.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#002970] to-[#0041a8] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50"
                >
                  <Bot className="h-3.5 w-3.5 text-[#00baf2]" aria-hidden="true" />
                  <span>Ask AI Guide</span>
                </motion.button>

                {doc.has_file && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => downloadDocument(doc.id, doc.filename).catch((err) => setError(err.message))}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#e3edf7] bg-white px-3.5 py-2 text-xs font-bold text-[#002970] transition-all hover:border-[#00baf2] hover:bg-[#f0f7fd]"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Download</span>
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => handleReanalyze(doc.id)}
                  disabled={busyId === doc.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#e3edf7] bg-white px-3.5 py-2 text-xs font-bold text-[#002970] transition-all hover:border-[#00baf2] hover:bg-[#f0f7fd] disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Re-analyze</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  disabled={busyId === doc.id}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
