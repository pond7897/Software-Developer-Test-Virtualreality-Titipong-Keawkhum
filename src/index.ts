import { app } from "./app";

const port = Number(process.env.PORT ?? 3000);
app.listen(port);

console.log(`Front Row Upgrade Queue API: http://${app.server?.hostname}:${app.server?.port}/api`);
