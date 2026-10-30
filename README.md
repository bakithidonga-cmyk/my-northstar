# Northstar

Northstar is a streaming-style movie and series discovery app. It uses TMDB for catalog details and YouTube trailers, with an optional native player for direct video URLs you are authorized to use.

## Credentials

The TMDB API Read Access Token is intentionally not included in this repository. In AppDeploy, configure the backend secret named `TMDB_READ_ACCESS_TOKEN`. The app reads it only on the backend.

## AppDeploy source

This source snapshot was exported from the deployed Northstar app. It uses AppDeploy platform-provided SDK packages (`@appdeploy/client` and `@appdeploy/sdk`) for frontend-to-backend requests and protected backend secrets. To run it on another host, replace those platform integrations and configure the TMDB token securely there.

TMDB provides catalog metadata and trailers, not full movie streams. Use only video URLs you have permission to stream.
