import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import api from '../lib/api';

export interface ParseResult {
  parsedData: any;
  confidence: Record<string, number>;
  attentionFields: string[];
  fileMeta?: {
    filename: string;
    saved_path: string;
    file_size: number;
  };
}

interface ResumeUploadProps {
  onParsed: (result: ParseResult) => void;
  className?: string;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTS = ['.pdf', '.docx'];

const PARSE_STEPS = [
  'Extracting document text...',
  'Extracting skills & education...',
  'Structuring experience & projects...',
  'Calibrating extraction confidence...',
];

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ onParsed, className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (uploading) {
      setStepIndex(0);
      timerRef.current = setInterval(() => {
        setStepIndex((prev) => (prev < PARSE_STEPS.length - 1 ? prev + 1 : prev));
      }, 2200);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [uploading]);

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    setWarningMsg(null);

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      setErrorMsg(`Unsupported file type (${ext}). Please upload a .pdf or .docx resume.`);
      return;
    }

    if (file.size > MAX_BYTES) {
      setErrorMsg(`File exceeds 5MB size limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      return;
    }

    if (file.size === 0) {
      setErrorMsg('The selected file is empty.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setUploadedFile({ name: file.name, size: file.size });

    try {
      const res = await api.post('/resume/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = res.data;
      if (!data.success) {
        setWarningMsg(
          data.error ||
            "We couldn't read all text automatically from this file, so please review or enter your details below."
        );
      }

      onParsed({
        parsedData: data.parsed_data || {},
        confidence: data.confidence || {},
        attentionFields: data.attention_fields || [],
        fileMeta: data.file_meta,
      });
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.message ||
        'Failed to parse resume. You can still complete your profile manually.';
      setErrorMsg(msg);
    } finally {
      setUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-7 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-blue-500 bg-blue-950/20 shadow-lg shadow-blue-900/20'
            : uploading
            ? 'border-blue-600/40 bg-zinc-900/50 cursor-wait'
            : uploadedFile
            ? 'border-zinc-700/80 hover:border-blue-500/60 bg-zinc-900/40'
            : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        {uploading ? (
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
                <Loader2 size={24} className="animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-white font-medium text-sm">{PARSE_STEPS[stepIndex]}</p>
              <p className="text-xs text-zinc-500 mt-1">Analyzing facts from {uploadedFile?.name}...</p>
            </div>
          </div>
        ) : uploadedFile ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-1 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white truncate max-w-xs">{uploadedFile.name}</h4>
                  <span className="text-[11px] text-zinc-400 font-mono">({formatFileSize(uploadedFile.size)})</span>
                </div>
                <p className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={12} /> Resume parsed into profile form below
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition"
            >
              <RefreshCw size={12} /> Replace file
            </button>
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto transition-transform group-hover:scale-105">
              <UploadCloud size={24} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Upload your resume to autofill</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Drag and drop your PDF or DOCX file (up to 5MB), or click to browse.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-zinc-500">
              <span className="px-2 py-0.5 rounded bg-zinc-800/80 font-mono">PDF</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800/80 font-mono">DOCX</span>
              <span>· Max 5MB</span>
            </div>
          </div>
        )}
      </div>

      {/* Warning message banner (e.g. unreadable/scanned PDF) */}
      {warningMsg && (
        <div className="rounded-xl bg-amber-950/30 border border-amber-800/40 p-4 flex items-start gap-3 text-amber-200">
          <AlertCircle size={18} className="shrink-0 text-amber-400 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-300">Notice about document reading</p>
            <p className="text-amber-200/90 leading-relaxed">{warningMsg}</p>
          </div>
        </div>
      )}

      {/* Error message banner */}
      {errorMsg && (
        <div className="rounded-xl bg-red-950/30 border border-red-800/40 p-4 flex items-start gap-3 text-red-200">
          <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-red-300">Could not parse file</p>
            <p className="text-red-200/90 leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
};
