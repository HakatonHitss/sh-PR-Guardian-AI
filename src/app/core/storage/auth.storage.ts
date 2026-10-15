import { EStorageType, storage } from '@claro/store';
import { environment } from '../../../environments/environment';

export const authStorage = storage({
  secretKey: environment.AUTH_STORAGE_SECRET_KEY,
  storageType: EStorageType.SESSION
});
