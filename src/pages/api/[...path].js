// The whole backend (backend/app.js, an Express app) runs here as one Vercel
// function, so the app and its API share a domain: /api/* and old /uploads/*.
import { createApp } from "../../../backend/app";

const app = createApp();

export const config = {
  api: {
    // Express parses bodies itself (JSON, and multipart for the old upload route).
    bodyParser: false,
    externalResolver: true,
    responseLimit: false,
  },
};

export default function handler(req, res) {
  return app(req, res);
}
