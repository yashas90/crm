import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/card";
import { Input } from "../components/input";

describe("Button", () => {
  it("renders a clickable button with label", () => {
    render(<Button type="button">Save lead</Button>);
    expect(screen.getByRole("button", { name: "Save lead" })).toBeEnabled();
  });

  it("supports variant classes", () => {
    render(
      <Button type="button" variant="outline">
        Outline
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Outline" })).toHaveClass("border");
  });
});

describe("Card", () => {
  it("renders header, description, and content", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Lead summary</CardTitle>
          <CardDescription>Recent activity</CardDescription>
        </CardHeader>
        <CardContent>
          <p>3 calls logged</p>
        </CardContent>
      </Card>,
    );

    expect(screen.getByText("Lead summary")).toBeInTheDocument();
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
    expect(screen.getByText("3 calls logged")).toBeInTheDocument();
  });
});

describe("Input", () => {
  it("renders an input with placeholder", () => {
    render(<Input placeholder="Search leads" aria-label="Search leads" />);
    expect(screen.getByPlaceholderText("Search leads")).toBeInTheDocument();
  });
});
