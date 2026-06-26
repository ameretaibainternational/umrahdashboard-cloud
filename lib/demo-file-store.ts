/** In-memory PDF blobs for demo mode (simulates R2 without credentials). */
class DemoFileStore {
  private files = new Map<string, Buffer>()

  set(key: string, data: Buffer) {
    this.files.set(key, data)
  }

  get(key: string): Buffer | undefined {
    return this.files.get(key)
  }

  delete(key: string) {
    this.files.delete(key)
  }

  clear() {
    this.files.clear()
  }
}

export const demoFileStore = new DemoFileStore()
