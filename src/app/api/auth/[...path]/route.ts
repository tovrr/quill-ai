import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const handler = toNextJsHandler(auth);

export const { GET, POST, PUT, DELETE, PATCH } = handler;
