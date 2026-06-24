import { TextField } from "@/components/ui/TextField";
import { render, screen } from "@testing-library/react-native";

describe("TextField", () => {
  it("renders without label or hint", () => {
    render(<TextField placeholder="Enter text" inputTestID="input" />);
    expect(screen.getByTestId("input")).toBeTruthy();
  });

  it("renders label when provided", () => {
    render(<TextField label="Full Name" inputTestID="input" />);
    expect(screen.getByText("Full Name")).toBeTruthy();
  });

  it("renders hint when provided", () => {
    render(<TextField hint="Max 50 chars" inputTestID="input" />);
    expect(screen.getByText("Max 50 chars")).toBeTruthy();
  });

  it("forwards placeholder to TextInput", () => {
    render(<TextField placeholder="Type here" inputTestID="input" />);
    const input = screen.getByTestId("input");
    expect(input.props.placeholder).toBe("Type here");
  });

  it("forwards value to TextInput", () => {
    render(<TextField value="hello" onChangeText={jest.fn()} inputTestID="input" />);
    const input = screen.getByTestId("input");
    expect(input.props.value).toBe("hello");
  });
});
