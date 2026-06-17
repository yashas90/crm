import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FirstLoginModal } from "./first-login-modal";

const mutateMock = vi.fn();

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({
    session: {
      id: "u1",
      name: "Agent One",
      email: "agent@example.com",
      role: "agent",
      isFirstLogin: true,
    },
    ready: true,
  }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useChangePassword: () => ({
    isPending: false,
    mutate: mutateMock,
  }),
}));

describe("FirstLoginModal", () => {
  it("shows welcome modal and submits password change", () => {
    render(<FirstLoginModal />);

    expect(screen.getByText(/Welcome to PropNinja! Please set your password/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: "TempPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "MyOwnPass456!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: "MyOwnPass456!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set password/i }));

    expect(mutateMock).toHaveBeenCalledWith(
      { currentPassword: "TempPass123!", newPassword: "MyOwnPass456!" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });
});
