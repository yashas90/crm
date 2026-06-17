"use client";

import { apiPost } from "@/lib/apiClient";
import { setAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

type ChangePasswordResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isFirstLogin: boolean;
  };
};

export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ChangePasswordInput) =>
      apiPost<ChangePasswordResponse>("/api/auth/change-password", payload),
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      void queryClient.invalidateQueries();
      toast.success("Password updated successfully");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Could not change password"));
    },
  });
}
