'use client';

import React, { useState, useRef, useCallback } from 'react';
import type { PrepFeedCategory } from '@/types';
import CrudSheet from '@/components/ui/CrudSheet';
import { Upload, Image as ImageIcon, X } from 'lucide-react';

const CATEGORIES: PrepFeedCategory[] = ['Gear', 'Food', 'Shelter', 'Cook Kit', 'Route', 'Campsite', 'Misc'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

interface PrepFeedFormSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { file: File; caption: string; category: PrepFeedCategory; uploaded_by: string }) => Promise<void>;
    defaultUploader?: string;
}

export default function PrepFeedFormSheet({ isOpen, onClose, onSubmit, defaultUploader = 'Jordan' }: PrepFeedFormSheetProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [category, setCategory] = useState<PrepFeedCategory>('Gear');
    const [uploadedBy, setUploadedBy] = useState(defaultUploader);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset form when opened
    React.useEffect(() => {
        if (isOpen) {
            setFile(null);
            setPreview(null);
            setCaption('');
            setCategory('Gear');
            setUploadedBy(defaultUploader);
            setError(null);
        }
    }, [isOpen, defaultUploader]);

    const handleFile = useCallback((f: File) => {
        if (!f.type.startsWith('image/')) {
            setError('Only image files are supported');
            return;
        }
        if (f.size > MAX_FILE_SIZE) {
            setError('File must be under 5 MB');
            return;
        }
        setError(null);
        setFile(f);
        const url = URL.createObjectURL(f);
        setPreview(url);
    }, []);

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragActive(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
    }

    function handleDrag(e: React.DragEvent) {
        e.preventDefault();
        setDragActive(e.type === 'dragenter' || e.type === 'dragover');
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (f) handleFile(f);
    }

    function clearFile() {
        setFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        if (inputRef.current) inputRef.current.value = '';
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!file) { setError('Select an image to upload'); return; }
        setSaving(true);
        try {
            await onSubmit({ file, caption: caption.trim(), category, uploaded_by: uploadedBy });
            onClose();
        } catch {
            setError('Upload failed. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <CrudSheet isOpen={isOpen} onClose={onClose} title="Log Field Asset">
            <form className="crud-form" onSubmit={handleSubmit} noValidate>

                {/* Drop zone */}
                <div className="crud-form__field">
                    <label className="crud-form__label">Image *</label>
                    {!preview ? (
                        <div
                            className={`prep-feed-dropzone ${dragActive ? 'prep-feed-dropzone--active' : ''}`}
                            onDrop={handleDrop}
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onClick={() => inputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
                        >
                            <Upload size={28} className="prep-feed-dropzone__icon" />
                            <span className="prep-feed-dropzone__text">
                                Drop image or click to browse
                            </span>
                            <span className="prep-feed-dropzone__hint">
                                JPG, PNG, WebP · Max 5 MB
                            </span>
                        </div>
                    ) : (
                        <div className="prep-feed-preview">
                            <img src={preview} alt="Preview" className="prep-feed-preview__img" />
                            <button type="button" className="prep-feed-preview__clear" onClick={clearFile} aria-label="Remove image">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleInputChange}
                        className="hidden"
                        tabIndex={-1}
                    />
                </div>

                {/* Caption */}
                <div className="crud-form__field">
                    <label className="crud-form__label" htmlFor="prep-caption">Caption</label>
                    <input
                        id="prep-caption"
                        className="crud-form__input"
                        type="text"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="e.g. Tent dry-run in the backyard"
                    />
                </div>

                {/* Category + Uploaded by */}
                <div className="crud-form__row">
                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="prep-category">Category</label>
                        <select
                            id="prep-category"
                            className="crud-form__select"
                            value={category}
                            onChange={(e) => setCategory(e.target.value as PrepFeedCategory)}
                        >
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="crud-form__field">
                        <label className="crud-form__label" htmlFor="prep-uploader">Logged by</label>
                        <select
                            id="prep-uploader"
                            className="crud-form__select"
                            value={uploadedBy}
                            onChange={(e) => setUploadedBy(e.target.value)}
                        >
                            <option value="Jordan">Jordan</option>
                            <option value="Liz">Liz</option>
                        </select>
                    </div>
                </div>

                {error && <p className="crud-form__error">{error}</p>}

                <div className="crud-form__actions">
                    <button type="button" className="crud-form__btn crud-form__btn--cancel" onClick={onClose}>Cancel</button>
                    <button type="submit" className="crud-form__btn crud-form__btn--save" disabled={saving || !file}>
                        {saving ? 'Uploading…' : 'Log Asset'}
                    </button>
                </div>
            </form>
        </CrudSheet>
    );
}
