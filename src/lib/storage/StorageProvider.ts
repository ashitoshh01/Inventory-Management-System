export interface StorageProvider {
  /**
   * Upload a file and return its public URL
   */
  upload(file: File, folder: string): Promise<string>;

  /**
   * Delete a file by its URL
   */
  delete(url: string): Promise<void>;
}
