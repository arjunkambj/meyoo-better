import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandler,
} from "mcp-handler";

const inferredAuthServerUrl =
  process.env.MCP_AUTH_SERVER_URL ??
  (process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/auth`
    : undefined);

const authServerUrls = inferredAuthServerUrl ? [inferredAuthServerUrl] : [];

if (authServerUrls.length === 0 && process.env.NODE_ENV === "development") {
  console.warn(
    "MCP_AUTH_SERVER_URL is not set. /.well-known/oauth-protected-resource will return an empty authServerUrls array."
  );
}

const handler = protectedResourceHandler({
  authServerUrls,
});

const optionsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, optionsHandler as OPTIONS };
