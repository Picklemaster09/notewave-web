declare module "serverless-http" {
  import type { Application } from "express";
  function serverless(app: Application): (event: unknown, context: unknown) => Promise<unknown>;
  export = serverless;
}
