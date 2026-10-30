import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };
export function useAuth(options?: UseAuthOptions) {
  const utils = trpc.useUtils(), cache = useQueryClient();
  const me = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const mutation = trpc.auth.logout.useMutation();
  const logout = useCallback(async () => {
    await mutation.mutateAsync();
    cache.clear();
    utils.auth.me.setData(undefined, null);
    window.location.assign("/staff/login");
  }, [mutation, cache, utils]);
  useEffect(() => {
    try { sessionStorage.removeItem("manus-cookie"); localStorage.removeItem("manus-runtime-user-info"); } catch {}
    if (options?.redirectOnUnauthenticated && !me.isLoading && !me.data && !me.error) {
      if (options.redirectPath) window.location.assign(options.redirectPath); else startLogin();
    }
  }, [options?.redirectOnUnauthenticated, options?.redirectPath, me.isLoading, me.data, me.error]);
  return { user: me.data ?? null, loading: me.isLoading || mutation.isPending, error: me.error ?? mutation.error ?? null, isAuthenticated: Boolean(me.data), refresh: () => me.refetch(), logout };
}
