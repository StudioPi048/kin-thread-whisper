import type { User } from "@supabase/supabase-js";

const AUTH_CHECK_TIMEOUT = 8000;
const INVALID_SESSION_CODES = new Set([
  "bad_jwt",
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "user_not_found",
]);

export async function withAuthCheckTimeout<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("A verificação da sessão demorou demais. Tente novamente.")),
          AUTH_CHECK_TIMEOUT,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function verifiedWorkspaceUser(): Promise<User | null> {
  const [{ supabase }, { isAuthSessionMissingError }] = await Promise.all([
    import("@/integrations/supabase/client"),
    import("@supabase/supabase-js"),
  ]);
  const { data, error } = await supabase.auth.getUser();
  if (!error) return data.user;
  if (
    isAuthSessionMissingError(error) ||
    error.status === 401 ||
    error.status === 403 ||
    (error.code && INVALID_SESSION_CODES.has(error.code))
  ) {
    return null;
  }
  throw error;
}
