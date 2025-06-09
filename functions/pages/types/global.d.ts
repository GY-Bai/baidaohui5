declare global {
  interface PagesContext<Env = any> {
    request: Request;
    env: Env;
    waitUntil: (promise: Promise<any>) => void;
  }

  type PagesFunction<Env = any> = (context: PagesContext<Env>) => Promise<Response> | Response;

  var caches: {
    default: Cache;
  };
}

export {}; 