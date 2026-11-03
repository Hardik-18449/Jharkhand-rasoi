import path from 'path';

// Default upload root: process.env.UPLOAD_DIR / UPLOAD_PATH, or fallback to <cwd>/uploads
export const defaultUploadRoot = () => {
    if (process.env.UPLOAD_DIR || process.env.UPLOAD_PATH) {
        return process.env.UPLOAD_DIR || process.env.UPLOAD_PATH;
    }
    return path.join(process.cwd(), 'uploads');
};

export const resolveUploadRoot = () => defaultUploadRoot();
