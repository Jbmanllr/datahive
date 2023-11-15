import databeeRoutes from './databee-routes';
import pollinatorRoutes from './pollinator-routes';
import honeycombRoutes from './honeycomb-routes';

export default {
  id: "datahive",
  handler: (router: any) => {
      databeeRoutes(router),
      pollinatorRoutes(router),
      honeycombRoutes(router)
  }
};