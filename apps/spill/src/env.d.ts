declare global {
  namespace NodeJS {
    interface ProcessEnv {
      COSMOS?: string;
    }
  }
}
