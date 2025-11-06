export class DisposableObjectURL {
  private url: string;

  constructor(source: Blob | MediaSource) {
    this.url = URL.createObjectURL(source);
  }

  get value() {
    return this.url;
  }

  [Symbol.dispose]() {
    URL.revokeObjectURL(this.url);
  }
}
