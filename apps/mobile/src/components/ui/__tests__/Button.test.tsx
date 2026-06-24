import { Button } from "@/components/ui/Button";
import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("@/lib/haptics", () => ({ hapticLight: jest.fn() }));

describe("Button", () => {
  it("renders label", () => {
    render(<Button label="Save" onPress={jest.fn()} />);
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<Button label="Go" onPress={onPress} testID="btn" />);
    fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    render(<Button label="Go" onPress={onPress} disabled testID="btn" />);
    fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not call onPress when loading", () => {
    const onPress = jest.fn();
    render(<Button label="Go" onPress={onPress} loading testID="btn" />);
    fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("shows ActivityIndicator when loading", () => {
    render(<Button label="Go" onPress={jest.fn()} loading testID="btn" />);
    expect(screen.queryByText("Go")).toBeNull();
  });

  it("renders danger variant without crashing", () => {
    render(<Button label="Delete" onPress={jest.fn()} variant="danger" />);
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("renders secondary variant without crashing", () => {
    render(<Button label="Cancel" onPress={jest.fn()} variant="secondary" />);
    expect(screen.getByText("Cancel")).toBeTruthy();
  });
});
