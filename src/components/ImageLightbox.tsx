import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { downloadImage } from '../utils/imageUtils';

interface Props {
    mimeType: string;
    base64Data: string;
    onClose: () => void;
}

export const ImageLightbox: React.FC<Props> = ({ mimeType, base64Data, onClose }) => {
    // 按 ESC 键关闭
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // 点击背景关闭
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            {/* 关闭按钮 */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
                title="关闭 (ESC)"
            >
                <X className="h-6 w-6" />
            </button>

            {/* 下载按钮 */}
            <button
                onClick={() => downloadImage(mimeType, base64Data)}
                className="absolute top-4 right-16 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
                title="下载图片"
            >
                <Download className="h-6 w-6" />
            </button>

            {/* 图片 */}
            <img
                src={`data:${mimeType};base64,${base64Data}`}
                alt="Full size image"
                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    );
};
