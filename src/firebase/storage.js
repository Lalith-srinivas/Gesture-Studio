/**
 * Firebase Storage Service
 * Handles user avatar and asset uploads with progress tracking
 */
import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

export const uploadUserAvatar = async (uid, file, onProgress = null) => {
  if (!uid || !file) throw new Error('User ID and file are required.');

  const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
  const filePath = `users/${uid}/avatars/avatar_${Date.now()}.${fileExt}`;
  const storageRef = ref(storage, filePath);

  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress(progress);
        }
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ downloadUrl, fullPath: filePath });
        } catch (err) {
          reject(err);
        }
      }
    );
  });
};

export const deleteStorageFile = async (filePath) => {
  if (!filePath) return;
  const storageRef = ref(storage, filePath);
  await deleteObject(storageRef);
};
