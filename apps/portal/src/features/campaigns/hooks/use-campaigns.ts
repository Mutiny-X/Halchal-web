import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adminApi,
  portalApi,
  type CampaignStatusFilter,
} from "@/lib/api";
import { useAuth, usePortalRole } from "@/providers/auth-provider";

const PAGE_SIZE = 200;

export function useCampaignsList(
  status: CampaignStatusFilter,
  page: number,
) {
  const { auth, getToken } = useAuth();
  const role = usePortalRole();
  const token = getToken();
  const apiStatus = status === "all" ? undefined : status;
  const isAdmin = role === "admin";

  return useQuery({
    queryKey: ["campaigns", isAdmin ? "admin" : "brand", status, page],
    queryFn: () => {
      if (isAdmin) {
        return adminApi.campaigns(token!, {
          status: apiStatus,
          page,
          limit: PAGE_SIZE,
        });
      }
      return portalApi.campaigns.list(token!, {
        status: apiStatus,
        page,
        limit: PAGE_SIZE,
      });
    },
    enabled: Boolean(auth && token),
  });
}

export function useCampaign(id: string | undefined) {
  const { auth, getToken } = useAuth();
  const token = getToken();

  return useQuery({
    queryKey: ["campaign", id],
    queryFn: () => portalApi.campaigns.get(token!, id!),
    enabled: Boolean(auth && token && id),
  });
}

export function useUpdateCampaignStatus() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "draft" | "live" | "paused" | "closed";
    }) => {
      const token = getToken();
      if (!token) throw new Error("Your session expired. Please log in again.");
      return portalApi.campaigns.update(token, id, { status });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign"] });
    },
  });
}

export function useUpdateCampaignAutoReview() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, autoReviewEnabled }: { id: string; autoReviewEnabled: boolean }) => {
      const token = getToken();
      if (!token) throw new Error("Your session expired. Please log in again.");
      return portalApi.campaigns.update(token, id, { autoReviewEnabled });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign"] });
    },
  });
}

export function useDeleteCampaign() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = getToken();
      if (!token) throw new Error("Your session expired. Please log in again.");
      return portalApi.campaigns.delete(token, id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export { PAGE_SIZE };
