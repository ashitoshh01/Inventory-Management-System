import { LocalDiskStorage } from "./LocalDiskStorage";
import { StorageProvider } from "./StorageProvider";

// Swap out this implementation when moving to S3
// export const storage: StorageProvider = new S3Storage();
export const storage: StorageProvider = new LocalDiskStorage();
